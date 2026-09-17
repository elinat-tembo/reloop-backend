const { eq, and, or, ne, sql } = require('drizzle-orm');

const { db } = require('../db');
const { swapRequests, clothingItems, users, messages } = require('../db/schema');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const { systemMessageValues } = require('../utils/systemMessages');
const logger = require('../config/logger');

async function getUserName(userId) {
  const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  return user?.name || 'A user';
}

async function createSwapRequest(req, res) {
  try {
    const { requestedItemId, offeredItemId } = req.body;

    if (!requestedItemId || !offeredItemId) {
      return res.status(400).json({ error: 'requestedItemId and offeredItemId are required' });
    }

    const [offeredItem] = await db
      .select()
      .from(clothingItems)
      .where(eq(clothingItems.id, offeredItemId));

    if (!offeredItem) {
      return res.status(404).json({ error: 'Offered item not found' });
    }

    if (offeredItem.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'You do not own the offered item' });
    }

    if (offeredItem.availability !== 'available') {
      return res.status(409).json({ error: 'Offered item is not available' });
    }

    const [requestedItem] = await db
      .select()
      .from(clothingItems)
      .where(eq(clothingItems.id, requestedItemId));

    if (!requestedItem) {
      return res.status(404).json({ error: 'Requested item not found' });
    }

    if (requestedItem.ownerId === req.user.id) {
      return res.status(400).json({ error: 'You cannot request your own item' });
    }

    if (requestedItem.availability !== 'available') {
      return res.status(409).json({ error: 'Requested item is not available' });
    }

    const [swapRequest] = await db
      .insert(swapRequests)
      .values({
        fromUserId: req.user.id,
        toUserId: requestedItem.ownerId,
        requestedItemId,
        offeredItemId,
      })
      .returning();

    return res.status(201).json({ swapRequest });
  } catch (err) {
    logger.error(`Create swap request failed: ${err.message}`);
    return res.status(500).json({ error: 'Something went wrong while creating the swap request' });
  }
}

async function getIncomingSwapRequests(req, res) {
  try {
    const { page, limit, offset } = parsePagination(req.query);

    const [requests, [{ count }]] = await Promise.all([
      db
        .select()
        .from(swapRequests)
        .where(eq(swapRequests.toUserId, req.user.id))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql`count(*)` })
        .from(swapRequests)
        .where(eq(swapRequests.toUserId, req.user.id)),
    ]);

    return res.json({ swapRequests: requests, pagination: buildPaginationMeta(page, limit, Number(count)) });
  } catch (err) {
    logger.error(`Fetching incoming swap requests failed: ${err.message}`);
    return res.status(500).json({ error: 'Something went wrong while fetching swap requests' });
  }
}

async function getOutgoingSwapRequests(req, res) {
  try {
    const { page, limit, offset } = parsePagination(req.query);

    const [requests, [{ count }]] = await Promise.all([
      db
        .select()
        .from(swapRequests)
        .where(eq(swapRequests.fromUserId, req.user.id))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql`count(*)` })
        .from(swapRequests)
        .where(eq(swapRequests.fromUserId, req.user.id)),
    ]);

    return res.json({ swapRequests: requests, pagination: buildPaginationMeta(page, limit, Number(count)) });
  } catch (err) {
    logger.error(`Fetching outgoing swap requests failed: ${err.message}`);
    return res.status(500).json({ error: 'Something went wrong while fetching swap requests' });
  }
}

async function getSwapRequestById(req, res) {
  try {
    const { id } = req.params;

    const [swapRequest] = await db.select().from(swapRequests).where(eq(swapRequests.id, id));
    if (!swapRequest) {
      return res.status(404).json({ error: 'Swap request not found' });
    }

    if (swapRequest.fromUserId !== req.user.id && swapRequest.toUserId !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to view this swap request' });
    }

    return res.json({ swapRequest });
  } catch (err) {
    logger.error(`Fetching swap request failed: ${err.message}`);
    return res.status(500).json({ error: 'Something went wrong while fetching the swap request' });
  }
}

async function acceptSwapRequest(req, res) {
  try {
    const { id } = req.params;

    const [swapRequest] = await db.select().from(swapRequests).where(eq(swapRequests.id, id));
    if (!swapRequest) {
      return res.status(404).json({ error: 'Swap request not found' });
    }

    if (swapRequest.toUserId !== req.user.id) {
      return res.status(403).json({ error: 'Only the recipient of this swap request can accept it' });
    }

    if (swapRequest.status !== 'pending') {
      return res.status(409).json({ error: `This swap request is no longer pending (status: ${swapRequest.status})` });
    }

    const { requestedItemId, offeredItemId } = swapRequest;
    const now = new Date();

    const [acceptedRows, , , expiredRows] = await db.batch([
      db
        .update(swapRequests)
        .set({ status: 'accepted', updatedAt: now })
        .where(eq(swapRequests.id, id))
        .returning(),
      db
        .update(clothingItems)
        .set({ availability: 'unavailable', updatedAt: now })
        .where(eq(clothingItems.id, requestedItemId)),
      db
        .update(clothingItems)
        .set({ availability: 'unavailable', updatedAt: now })
        .where(eq(clothingItems.id, offeredItemId)),
      db
        .update(swapRequests)
        .set({ status: 'expired', updatedAt: now })
        .where(
          and(
            ne(swapRequests.id, id),
            eq(swapRequests.status, 'pending'),
            or(
              eq(swapRequests.requestedItemId, requestedItemId),
              eq(swapRequests.offeredItemId, requestedItemId),
              eq(swapRequests.requestedItemId, offeredItemId),
              eq(swapRequests.offeredItemId, offeredItemId)
            )
          )
        )
        .returning(),
    ]);

    const updatedSwap = acceptedRows[0];
    const toUserName = await getUserName(updatedSwap.toUserId);

    const systemMessagesToInsert = [
      systemMessageValues(updatedSwap.id, `${toUserName} accepted this swap request.`),
      ...expiredRows.map((expired) =>
        systemMessageValues(
          expired.id,
          'This swap request expired because one of the items was used in another accepted swap.'
        )
      ),
    ];
    await db.insert(messages).values(systemMessagesToInsert);

    return res.json({ swapRequest: updatedSwap });
  } catch (err) {
    logger.error(`Accept swap request failed: ${err.message}`);
    return res.status(500).json({ error: 'Something went wrong while accepting the swap request' });
  }
}

async function rejectSwapRequest(req, res) {
  try {
    const { id } = req.params;

    const [swapRequest] = await db.select().from(swapRequests).where(eq(swapRequests.id, id));
    if (!swapRequest) {
      return res.status(404).json({ error: 'Swap request not found' });
    }

    if (swapRequest.toUserId !== req.user.id) {
      return res.status(403).json({ error: 'Only the recipient of this swap request can reject it' });
    }

    if (swapRequest.status !== 'pending') {
      return res.status(409).json({ error: `This swap request is no longer pending (status: ${swapRequest.status})` });
    }

    const [updated] = await db
      .update(swapRequests)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(eq(swapRequests.id, id))
      .returning();

    const toUserName = await getUserName(updated.toUserId);
    await db.insert(messages).values(
      systemMessageValues(updated.id, `${toUserName} rejected this swap request.`)
    );

    return res.json({ swapRequest: updated });
  } catch (err) {
    logger.error(`Reject swap request failed: ${err.message}`);
    return res.status(500).json({ error: 'Something went wrong while rejecting the swap request' });
  }
}

async function cancelSwapRequest(req, res) {
  try {
    const { id } = req.params;

    const [swapRequest] = await db.select().from(swapRequests).where(eq(swapRequests.id, id));
    if (!swapRequest) {
      return res.status(404).json({ error: 'Swap request not found' });
    }

    if (swapRequest.fromUserId !== req.user.id) {
      return res.status(403).json({ error: 'Only the sender of this swap request can cancel it' });
    }

    if (swapRequest.status !== 'pending') {
      return res.status(409).json({ error: `This swap request is no longer pending (status: ${swapRequest.status})` });
    }

    const [updated] = await db
      .update(swapRequests)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(swapRequests.id, id))
      .returning();

    const fromUserName = await getUserName(updated.fromUserId);
    await db.insert(messages).values(
      systemMessageValues(updated.id, `${fromUserName} cancelled this swap request.`)
    );

    return res.json({ swapRequest: updated });
  } catch (err) {
    logger.error(`Cancel swap request failed: ${err.message}`);
    return res.status(500).json({ error: 'Something went wrong while cancelling the swap request' });
  }
}

module.exports = {
  createSwapRequest,
  getIncomingSwapRequests,
  getOutgoingSwapRequests,
  getSwapRequestById,
  acceptSwapRequest,
  rejectSwapRequest,
  cancelSwapRequest,
};
