const { eq, and, gt, asc } = require('drizzle-orm');

const { db } = require('../db');
const { swapRequests, messages } = require('../db/schema');
const logger = require('../config/logger');

async function getAuthorizedSwapRequest(swapId, userId) {
  const [swapRequest] = await db.select().from(swapRequests).where(eq(swapRequests.id, swapId));
  if (!swapRequest) {
    return { error: 'not_found' };
  }

  if (swapRequest.fromUserId !== userId && swapRequest.toUserId !== userId) {
    return { error: 'forbidden' };
  }

  return { swapRequest };
}

async function sendMessage(req, res) {
  try {
    const { swapId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'content is required' });
    }

    const { swapRequest, error } = await getAuthorizedSwapRequest(swapId, req.user.id);
    if (error === 'not_found') {
      return res.status(404).json({ error: 'Swap request not found' });
    }
    if (error === 'forbidden') {
      return res
        .status(403)
        .json({ error: 'You do not have permission to send messages on this swap request' });
    }

    const [message] = await db
      .insert(messages)
      .values({
        swapRequestId: swapRequest.id,
        senderId: req.user.id,
        content: content.trim(),
      })
      .returning();

    return res.status(201).json({ message });
  } catch (err) {
    logger.error(`Send message failed: ${err.message}`);
    return res.status(500).json({ error: 'Something went wrong while sending the message' });
  }
}

async function getMessages(req, res) {
  try {
    const { swapId } = req.params;
    const { after } = req.query;

    const { swapRequest, error } = await getAuthorizedSwapRequest(swapId, req.user.id);
    if (error === 'not_found') {
      return res.status(404).json({ error: 'Swap request not found' });
    }
    if (error === 'forbidden') {
      return res
        .status(403)
        .json({ error: 'You do not have permission to view messages on this swap request' });
    }

    const conditions = [eq(messages.swapRequestId, swapRequest.id)];
    if (after !== undefined) {
      const afterId = parseInt(after, 10);
      if (!Number.isInteger(afterId) || afterId < 0) {
        return res.status(400).json({ error: 'after must be a valid message id' });
      }
      conditions.push(gt(messages.id, afterId));
    }

    const results = await db
      .select()
      .from(messages)
      .where(and(...conditions))
      .orderBy(asc(messages.id));

    return res.json({ messages: results });
  } catch (err) {
    logger.error(`Fetching messages failed: ${err.message}`);
    return res.status(500).json({ error: 'Something went wrong while fetching messages' });
  }
}

module.exports = { sendMessage, getMessages };
