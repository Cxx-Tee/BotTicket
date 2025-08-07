async function sendTranscript(channel) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const content = messages
    .map(msg => `[${msg.createdAt.toISOString()}] ${msg.author?.tag || msg.author?.username || 'Unknown'}: ${msg.content}`)
    .reverse()
    .join('\n');

  // หา owner ของ ticket จากข้อความแรก (ถ้ามี mention)
  let ticketOwner = null;
  if (messages.size > 0) {
    const firstMsg = messages.last();
    const match = firstMsg?.content?.match(/<@(\d+)>/);
    if (match) ticketOwner = `<@${match[1]}>`;
  }

  const fs = require('fs');
  const path = require('path');
  const transcriptPath = path.join(__dirname, `../logs/${channel.name}-transcript.txt`);
  fs.writeFileSync(transcriptPath, content);

  try {
    const logChannel = await channel.guild.channels.fetch(require('../config.json').logChannelId);
    if (logChannel && logChannel.isTextBased()) {
      await logChannel.send({
        content: `🗃️ Transcript for **${channel.name}**\n👤 Ticket Owner: ${ticketOwner || 'ไม่พบ'}\n\n`,
        files: [transcriptPath]
      });
    }
  } catch (e) {
    // ไม่ต้อง throw error ถ้า logChannel ไม่มี
  }
}

module.exports = { sendTranscript };
