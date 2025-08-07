const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionsBitField
} = require('discord.js');
const config = require('../config.json');
const { saveLog } = require('../utils/logger');
const { sendTranscript } = require('../utils/transcript');


// ฟังก์ชันสร้าง ticket สำหรับเรียกจาก index.js หรือ select menu

async function createTicket({ interaction, customId, user, guild }) {
  // ป้องกัน user เปิด ticket ซ้ำประเภทเดียวกัน (โดยเฉพาะ other)
  let channel;
  const t0 = Date.now();
  try {
    if (interaction._ticketLock) return;
    interaction._ticketLock = true;
    // ต้อง deferReply เป็นบรรทัดแรกหลังเช็ค lock
    const ephemeralTypes = ["support", "report", "donate"];
    const isEphemeral = ephemeralTypes.includes(customId);
    console.log(`[TICKET] [${user.tag}] about to deferReply at ${new Date().toISOString()}`);
    try {
      await interaction.deferReply({ ephemeral: isEphemeral });
      console.log(`[TICKET] [${user.tag}] deferReply success at ${new Date().toISOString()}`);
    } catch (deferErr) {
      console.error('[TICKET] deferReply error:', deferErr);
      return;
    }

    let already = null;
    let freshChannels = null;
    // เลือก categoryId ตามประเภท ticket
    const categoryId = (config.categoryId && config.categoryId[customId]) ? config.categoryId[customId] : config.categoryId.support;
    try {
      freshChannels = await guild.channels.fetch();
    } catch (e) {
      console.error('[TICKET] fetch channels error:', e);
    }
    if (freshChannels) {
      already = freshChannels.find(c =>
        c.parentId === categoryId &&
        c.type === ChannelType.GuildText &&
        c.name.startsWith(`ticket-${customId}-`) &&
        c.permissionOverwrites?.cache?.has(user.id)
      );
    }
    if (already) {
      await interaction.editReply({ content: `❌ คุณมี ticket ประเภทนี้อยู่แล้ว: <#${already.id}>` });
      try { if (!user.bot) await user.send(`คุณมี ticket ประเภทนี้อยู่แล้ว: <#${already.id}>`); } catch {}
      return;
    }
    await interaction.editReply({ content: '⏳ กำลังสร้าง ticket...' });
    console.log(`[TICKET] [${user.tag}] no duplicate, start create channel at ${new Date().toISOString()}`);
    const extraRoles = require('../extraRoles');
    const extraRolePerms = (Array.isArray(extraRoles) ? extraRoles : []).map(rid => ({ id: rid, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }));
    channel = await guild.channels.create({
      name: `ticket-${customId}-${user.username}`,
      type: ChannelType.GuildText,
      parent: categoryId,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: config.adminRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: config.supportRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        config.viewerRoleId ? { id: config.viewerRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] } : null,
        ...extraRolePerms
      ].filter(Boolean)
    });
    console.log(`[TICKET] [${user.tag}] channel created at ${new Date().toISOString()}`);
  } catch (err) {
    console.error('[TICKET] create channel error:', err);
    try { await interaction.editReply({ content: '❌ ไม่สามารถสร้างห้อง ticket ได้: ' + err.message }); } catch {}
    return;
  }

  // ตอบ interaction user ทันทีหลังสร้างห้อง ไม่รอ DM/notify admin
  try {
    await interaction.editReply({ content: `✅ เปิด ticket แล้วที่ ${channel}` });
    console.log(`[TICKET] [${user.tag}] interaction.editReply done at ${new Date().toISOString()} (total: ${Date.now() - t0}ms)`);
  } catch (e) {}

  // fire-and-forget admin notify
  notifyAdmins({ guild, user, channel }).catch(e => console.error('[TICKET] admin notify error:', e));

// ฟังก์ชันแจ้งเตือนแอดมินหรือ owner ทาง DM (fire-and-forget)
async function notifyAdmins({ guild, user, channel }) {
  const adminRoleId = config.adminRoleId;
  if (!adminRoleId) return;
  try {
    const adminRole = await guild.roles.fetch(adminRoleId);
    if (!adminRole) return;
    let adminMembers = null;
    try {
      adminMembers = await guild.members.fetch({ withRoles: [adminRoleId] });
    } catch (e) {
      console.error('[TICKET] fetch admin members error:', e);
    }
    const msg = `📢 มีการเปิด ticket ใหม่\nผู้เปิด: ${user.tag} (${user.id})\nห้อง: <#${channel.id}>\nเวลา: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`;
    if (!adminMembers || adminMembers.size === 0) {
      try {
        const owner = await guild.fetchOwner();
        await owner.send(msg);
        console.log(`[TICKET] DM owner success at ${new Date().toISOString()}`);
      } catch (e) {
        console.error('[TICKET] DM owner error:', e);
      }
    } else {
      const dmPromises = Array.from(adminMembers.values()).map(admin =>
        admin.send(msg)
          .then(() => ({ tag: admin.user.tag, status: 'fulfilled' }))
          .catch(e => ({ tag: admin.user.tag, status: 'rejected', reason: e }))
      );
      const results = await Promise.allSettled(dmPromises);
      results.forEach((result, i) => {
        const admin = Array.from(adminMembers.values())[i];
        if (result.status === 'fulfilled' && result.value.status === 'fulfilled') {
          console.log(`[TICKET] DM admin ${result.value.tag} success at ${new Date().toISOString()}`);
        } else {
          const reason = result.value?.reason || result.reason;
          console.error(`[TICKET] DM admin ${result.value?.tag || admin.user.tag} error:`, reason);
        }
      });
    }
  } catch (e) {
    console.error('[TICKET] fetch role or admin notify error:', e);
    // fallback แจ้ง owner
    try {
      const owner = await guild.fetchOwner();
      const msg = `📢 มีการเปิด ticket ใหม่\nผู้เปิด: ${user.tag} (${user.id})\nห้อง: <#${channel.id}>\nเวลา: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`;
      await owner.send(msg);
      console.log(`[TICKET] DM owner (fallback) success at ${new Date().toISOString()}`);
    } catch (e2) {
      console.error('[TICKET] DM owner (fallback) error:', e2);
    }
  }
}

  const closeBtn = new ButtonBuilder()
    .setCustomId(`close-${channel.id}`)
    .setLabel('🔒 ปิด Ticket')
    .setStyle(ButtonStyle.Danger);

  const threadBtn = new ButtonBuilder()
    .setCustomId(`thread-${customId}`)
    .setLabel('📑 สร้างเธรด')
    .setStyle(ButtonStyle.Primary);

  const cancelAutoBtn = new ButtonBuilder()
    .setCustomId(`cancelauto-${channel.id}`)
    .setLabel('❌ ยกเลิกปิดอัตโนมัติ')
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(closeBtn, threadBtn, cancelAutoBtn);

  let description = '';
  let mentionRoles = '';
  if (customId === 'report') {
    // ดึง role สำคัญจาก config และ extraRoles
    const extraRoles = require('../extraRoles');
    const adminMention = config.adminRoleId ? `<@&${config.adminRoleId}>` : '';
    const extraMentions = (Array.isArray(extraRoles) ? extraRoles : []).map(rid => `<@&${rid}>`).join(' ');
    mentionRoles = [adminMention, extraMentions].filter(Boolean).join(' ');
    description = `\n\n${mentionRoles}\n**โปรดแจ้งรายละเอียดปัญหาหรือเหตุการณ์ที่ต้องการรายงานให้ชัดเจน**\nตัวอย่าง: วันที่/เวลา, เหตุการณ์, หลักฐาน (ถ้ามี)\n\nPlease describe the issue or incident you want to report clearly.\nExample: date/time, what happened, evidence (if any)`;
  }
  // หมายเหตุ auto close
  const autoCloseNote = '\n\n⚠️ **หมายเหตุ:** หากไม่มีการตอบกลับหรือเปิดทิ้งไว้ Ticket จะถูกปิดอัตโนมัติภายใน 24 ชั่วโมง\nNote: If there is no response or left open, the ticket will be auto-closed within 24 hours.';
  // ส่งข้อความใน channel ทันทีหลังสร้าง ไม่ fetch channel ซ้ำ
  // ส่งข้อความในห้องแบบ fire-and-forget ไม่ await promise ใดๆ
  const ticketMsgOptions = {
    content: `<@${user.id}> ได้เปิด ticket ประเภท: **${customId}**${description}${autoCloseNote}`,
    components: [row]
  };
  if (["support", "report", "donate"].includes(customId)) {
    ticketMsgOptions.flags = 64; // ทำให้แสดงปุ่มปิดข้อความ
  }
  channel.send(ticketMsgOptions).then(() => {
    console.log(`[TICKET] [${user.tag}] sent message to channel at ${new Date().toISOString()}`);
  }).catch(err => {
    console.error('[TICKET] send message error:', err);
    interaction.editReply({ content: '❌ สร้างห้อง ticket แล้วแต่ไม่สามารถส่งข้อความได้: ' + err.message }).catch(e => console.error('[TICKET] interaction.editReply error:', e));
    if (!user.bot) user.send('❌ สร้างห้อง ticket แล้วแต่ไม่สามารถส่งข้อความในห้องได้').catch(e => console.error('[TICKET] DM user error:', e));
  });

  // DM แจ้งเตือน พร้อมแท็กห้อง
  // ส่ง DM user แบบ fire-and-forget ไม่ await promise ใดๆ
  if (!user.bot) {
    user.send(`✅ คุณได้เปิด ticket ประเภท: **${customId}** ที่เซิร์ฟเวอร์ ${guild.name}\nห้องของคุณ: <#${channel.id}>`)
      .then(() => {
        console.log(`[TICKET] [${user.tag}] DM success at ${new Date().toISOString()}`);
      })
      .catch(err => {
        console.warn(`[DM] ไม่สามารถส่งข้อความถึง ${user.tag} (${user.id}): ${err.message}`);
        channel.send(`⚠️ <@${user.id}> ไม่สามารถรับ DM จากบอทได้`).catch(e => console.error('[TICKET] send warn to channel error:', e));
      });
  }

  // log
  saveLog({ action: 'open_ticket', user: user.tag, category: customId, channel: channel.name });
  const t1 = Date.now();
  // แจ้ง user ใน interaction ว่าสร้างเสร็จแล้ว (editReply)
  try {
    await interaction.editReply({ content: `✅ เปิด ticket แล้วที่ ${channel}` });
    console.log(`[TICKET] [${user.tag}] interaction.editReply done at ${new Date().toISOString()} (total: ${t1 - t0}ms)`);
  } catch (e) {}
}

// เก็บสถานะปิดออโต้ของแต่ละ channel
const autoCloseDisabled = new Map();

module.exports = (client) => {
// export ฟังก์ชันสำหรับเรียกใช้งานจาก index.js
module.exports.createTicket = createTicket;
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    const { customId, user, guild, member } = interaction;
    try {
      // Log ทุก interaction ปุ่ม
      console.log(`[TICKET] interactionCreate: customId=${customId}, user=${user.tag}, id=${interaction.id}, replied=${interaction.replied}, deferred=${interaction.deferred}`);
      // ปุ่มเปิด ticket
      if (["support", "report", "donate", "other"].includes(customId)) {
        await createTicket({ interaction, customId, user, guild });
        return;
      }
      // ปุ่มยกเลิกปิดออโต้ (เฉพาะแอดมินและ extraRoles)
      if (customId.startsWith('cancelauto-')) {
        const extraRoles = require('../extraRoles');
        const allowedRoles = [config.adminRoleId, ...(Array.isArray(extraRoles) ? extraRoles : [])];
        const isAllowed = member.roles.cache.some(r => allowedRoles.includes(r.id));
        if (!isAllowed) {
          if (interaction.channel) {
            await interaction.reply({ content: 'คุณไม่มีสิทธิ์ใช้ปุ่มนี้', flags: 64 });
          }
          return;
        }
        const channelId = customId.split('-')[1];
        autoCloseDisabled.set(channelId, true);
        if (interaction.channel) {
          await interaction.reply({ content: '✅ ยกเลิกปิดอัตโนมัติสำหรับห้องนี้แล้ว', flags: 64 });
        }
        return;
      }
      // ปุ่มปิด ticket
      if (customId.startsWith('close-')) {
        try {
          await interaction.reply({ content: 'กำลังปิด Ticket...', flags: 64 });
        } catch (e) { console.warn('[TICKET] close button reply error:', e); }
        const channel = interaction.guild.channels.cache.get(customId.split('-')[1]);
        if (channel) {
          try {
            await channel.send('❌ Ticket จะถูกปิดใน 5 วินาที...');
            await sendTranscript(channel);
            setTimeout(() => channel.delete().catch(e => console.error('[TICKET] delete channel error:', e)), 5000);
          } catch (e) { console.error('[TICKET] close button channel error:', e); }
        }
        return;
      }
      // ปุ่มสร้างเธรด
      if (customId.startsWith('thread-')) {
        try {
          const thread = await interaction.channel.threads.create({
            name: `discussion-${interaction.user.username}`,
            autoArchiveDuration: 1440,
            reason: 'User started a discussion thread'
          });
          await thread.send(`📩 เริ่มเธรดโดย: <@${interaction.user.id}>`);
        } catch (e) { console.error('[TICKET] thread button error:', e); }
        return;
      }
    } catch (err) {
      console.error('[TICKET] interactionCreate error:', err);
      try { await interaction.reply({ content: 'เกิดข้อผิดพลาด: ' + err.message, flags: 64 }); } catch {}
    }
  });

  // ตรวจสอบ inactivity และปิดอัตโนมัติ
  setInterval(async () => {
    const guild = await client.guilds.fetch(config.guildId);
    const channels = await guild.channels.fetch();
    const now = Date.now();
    const timeout = config.inactiveTimeoutHours * 60 * 60 * 1000;

    channels.forEach(async (channel) => {
      // ตรวจสอบเฉพาะ ticket category ที่กำหนดใน config
      if (channel.type !== ChannelType.GuildText || !Object.values(config.categoryId).includes(channel.parentId)) return;

      // ถ้ายกเลิกปิดออโต้ไว้ ให้ข้าม
      if (autoCloseDisabled.get(channel.id)) return;

      const messages = await channel.messages.fetch({ limit: 1 });
      const lastMsg = messages.first();
      if (lastMsg && now - lastMsg.createdTimestamp > timeout) {
        await channel.send('🕒 ไม่มีการตอบกลับใน 24 ชั่วโมง กำลังปิด Ticket');
        await sendTranscript(channel);
        setTimeout(() => channel.delete(), 5000);
      }
    });
  }, 60 * 60 * 1000); // เช็คทุก 1 ชั่วโมง
};
