const { messages } = require('../db/schema');

function systemMessageValues(swapRequestId, content) {
  return { swapRequestId, senderId: null, isSystem: true, content };
}

async function insertSystemMessage(db, swapRequestId, content) {
  return db.insert(messages).values(systemMessageValues(swapRequestId, content));
}

module.exports = { systemMessageValues, insertSystemMessage };
