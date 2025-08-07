# BotTicket
อยู่ในช่วงพัฒนา

# คำอธิบายไฟล์ config.json, .env, extraRoles.js

## 1. config.json
ไฟล์นี้ใช้เก็บค่าคอนฟิกหลักของบอท เช่น token, id ต่างๆ, หมวดหมู่ ticket, role ฯลฯ

### ตัวอย่าง
```json
{
  "token": "<DISCORD_BOT_TOKEN>",
  "clientId": "<BOT_CLIENT_ID>",
  "guildId": "<SERVER_ID>",
  "categoryId": {
    "support": "<CATEGORY_ID_SUPPORT>",
    "report": "<CATEGORY_ID_REPORT>",
    "donate": "<CATEGORY_ID_DONATE>"
  },
  "logChannelId": "<LOG_CHANNEL_ID>",
  "supportRoleId": "<SUPPORT_ROLE_ID>",
  "adminRoleId": "<ADMIN_ROLE_ID>",
  "viewerRoleId": "<VIEWER_ROLE_ID>",
  "inactiveTimeoutHours": 24
}
```

- `token`: Token ของ Discord Bot (ควรเก็บใน .env เพื่อความปลอดภัย)
- `clientId`: Client ID ของบอท
- `guildId`: Server ID
- `categoryId`: กำหนดหมวดหมู่ของแต่ละประเภท ticket (support, report, donate)
- `logChannelId`: ช่องสำหรับ log
- `supportRoleId`, `adminRoleId`, `viewerRoleId`: กำหนด role สำหรับสิทธิ์ต่างๆ
- `inactiveTimeoutHours`: เวลาปิด ticket อัตโนมัติ (ชั่วโมง)

## 2. .env
ไฟล์นี้ใช้เก็บข้อมูลลับ เช่น token, database url ฯลฯ (ต้องเพิ่มใน .gitignore)

### ตัวอย่าง
```
DISCORD_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DATABASE_URL=mongodb://localhost:27017/ticketbot
```

## 3. extraRoles.js
ไฟล์นี้ export array ของ role id ที่ต้องการให้มีสิทธิ์พิเศษเพิ่มเติม (เช่น เห็นทุก ticket)

### ตัวอย่าง
```js
// extraRoles.js
module.exports = [
  "123456789012345678",
  "234567890123456789"
];
```

- ใส่เฉพาะ role id ที่ต้องการให้มีสิทธิ์พิเศษ (ถ้าไม่ใช้ ให้ export เป็น array ว่าง)

---
**หมายเหตุ:**
- ควรเก็บ token ใน .env แล้วให้ config.json อ่านจาก process.env แทนเพื่อความปลอดภัย
- ตัวอย่างนี้เหมาะกับ Discord.js v14+
