require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();
client.buttons = new Collection();

const buttonsHandler = require('./components/buttons');
buttonsHandler(client);

client.login(config.token);

const { REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Register /ticket command (เฉพาะตอนรันบอท)
const commands = [
  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('สร้าง ticket ใหม่')
    .toJSON()
];

const rest = new REST({ version: '10' }).setToken(config.token);
rest.put(
  Routes.applicationGuildCommands(config.clientId, config.guildId),
  { body: commands }
).catch(console.error);

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === 'ticket') {
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const embed = new EmbedBuilder()
      .setTitle('🎫 Ticket Service')
      .setDescription('กรุณาเลือกหัวข้อที่ท่านประสงค์จะสอบถาม\n\nMeta Script Collective ( Team )')
      .setImage('https://media.discordapp.net/attachments/112211111111111111/112211111111111111/banner.png')
      .setColor(0x2b2d31);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('support')
        .setLabel('🎫 ขอความช่วยเหลือ (Support)')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('report')
        .setLabel('🚨 แจ้งปัญหา (Report)')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('donate')
        .setLabel('💸 สนับสนุน (Donate)')
        .setStyle(ButtonStyle.Success)
    );
    await interaction.reply({
      embeds: [embed],
      components: [row]
    });
  }

  // handle ปุ่มกดเปิด ticket (support, report, donate, other)
  if (interaction.isButton() && ['support', 'report', 'donate'].includes(interaction.customId)) {
    // ไม่ต้อง reply/defer ที่นี่ ให้ createTicket จัดการเอง
    const { createTicket } = require('./components/buttons');
    try {
      await createTicket({
        interaction,
        customId: interaction.customId,
        user: interaction.user,
        guild: interaction.guild
      });
    } catch (err) {
      console.error('[TICKET] createTicket error:', err);
      try { await interaction.editReply({ content: 'เกิดข้อผิดพลาด: ' + err.message }); } catch {}
    }
  }
});
