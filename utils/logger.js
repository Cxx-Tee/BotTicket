const fs = require('fs');
const path = require('path');
const logPath = path.join(__dirname, '../logs/ticket-logs.json');

function saveLog(data) {
  let logData = [];
  try {
    if (fs.existsSync(logPath)) {
      logData = JSON.parse(fs.readFileSync(logPath));
    }
  } catch (e) {
    logData = [];
  }
  logData.push({ ...data, timestamp: new Date().toISOString() });
  fs.writeFileSync(logPath, JSON.stringify(logData, null, 2));
}

module.exports = { saveLog };