const { eq, and, or, sql, asc } = require('drizzle-orm');

const { db } = require('../db');
const { users, clothingItems, swapRequests, messages } = require('../db/schema');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const { systemMessageValues } = require('../utils/systemMessages');
const { SWAP_STATUSES } = require('../constants/swapStatuses');
const logger = require('../config/logger');

const PUBLIC_USER_COLUMNS = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  isActive: users.isActive,
  createdAt: users.createdAt,
};

async function getAllUsers(req, res) {
  try {
    const { page, limit, offset } = parsePagination(req.query);

    const [rows, [{ count }]] = await Promise.all([
      db.select(PUBLIC_USER_COLUMNS).from(users).limit(limit).offset(offset),
      db.select({ count: sql`count(*)` }).from(users),
    ]);

    return res.json({ users: rows, pagination: buildPaginationMeta(page, limit, Number(count)) });
  } catch (err) {
    logger.error(`Fetching users failed: ${err.message}`);
    return res.status(500).json({ error: 'Something went wrong while fetching users' });
  }
}

async function setUserActive(req, res, isActive) {
  try {
    const { id } = req.params;

    const [updated] = await db
      .update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning(PUBLIC_USER_COLUMNS);

    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user: updated });
  } catch (err) {
    logger.error(`Updating user active state failed: ${err.message}`);
    return res.status(500).json({ error: 'Something went wrong while updating the user' });
  }
}

async function deactivateUser(req, res) {
  return setUserActive(req, res, false);
}

async function activateUser(req, res) {
  return setUserActive(req, res, true);
}

async function getAllListings(req, res) {
  try {
    const { city, region, type, condition } = req.query;
    const { page, limit, offset } = parsePagination(req.query);

    const conditions = [];
    if (city) conditions.push(eq(clothingItems.city, city));
    if (region) conditions.push(eq(clothingItems.region, region));
    if (type) conditions.push(eq(clothingItems.type, type));
    if (condition) conditions.push(eq(clothingItems.condition, condition));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let dataQuery = db.select().from(clothingItems);
    let countQuery = db.select({ count: sql`count(*)` }).from(clothingItems);
    if (whereClause) {
      dataQuery = dataQuery.where(whereClause);
      countQuery = countQuery.where(whereClause);
    }

    const [listings, [{ count }]] = await Promise.all([
      dataQuery.limit(limit).offset(offset),
      countQuery,
    ]);

    return res.json({ listings, pagination: buildPaginationMeta(page, limit, Number(count)) });
  } catch (err) {
    logger.error(`Fetching admin listings failed: ${err.message}`);
    return res.status(500).json({ error: 'Something went wrong while fetching listings' });
  }
}

async function forceDeleteListing(req, res) {
  try {
    const { id } = req.params;

    const [listing] = await db.select().from(clothingItems).where(eq(clothingItems.id, id));
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const pendingRequests = await db
      .select()
      .from(swapRequests)
      .where(
        and(
          or(eq(swapRequests.requestedItemId, id), eq(swapRequests.offeredItemId, id)),
          eq(swapRequests.status, 'pending')
        )
      );

    const now = new Date();

    for (const swapRequest of pendingRequests) {
      const otherItemId =
        swapRequest.requestedItemId === listing.id
          ? swapRequest.offeredItemId
          : swapRequest.requestedItemId;

      await db.batch([
        db
          .update(swapRequests)
          .set({ status: 'cancelled_by_admin', updatedAt: now })
          .where(eq(swapRequests.id, swapRequest.id)),
        db
          .update(clothingItems)
          .set({ availability: 'available', updatedAt: now })
          .where(eq(clothingItems.id, otherItemId)),
        db
          .insert(messages)
          .values(
            systemMessageValues(
              swapRequest.id,
              'This swap was cancelled because a listed item was removed by an admin.'
            )
          ),
      ]);
    }

    await db.delete(clothingItems).where(eq(clothingItems.id, id));

    return res.json({
      message: 'Listing deleted successfully',
      cancelledSwapRequests: pendingRequests.length,
    });
  } catch (err) {
    logger.error(`Admin force-delete listing failed: ${err.message}`);
    return res.status(500).json({ error: 'Something went wrong while deleting the listing' });
  }
}

async function getAllSwaps(req, res) {
  try {
    const { page, limit, offset } = parsePagination(req.query);

    const [rows, [{ count }]] = await Promise.all([
      db.select().from(swapRequests).limit(limit).offset(offset),
      db.select({ count: sql`count(*)` }).from(swapRequests),
    ]);

    return res.json({
      swapRequests: rows,
      pagination: buildPaginationMeta(page, limit, Number(count)),
    });
  } catch (err) {
    logger.error(`Fetching admin swaps failed: ${err.message}`);
    return res.status(500).json({ error: 'Something went wrong while fetching swap requests' });
  }
}

async function getSwapMessages(req, res) {
  try {
    const { id } = req.params;

    const [swapRequest] = await db.select().from(swapRequests).where(eq(swapRequests.id, id));
    if (!swapRequest) {
      return res.status(404).json({ error: 'Swap request not found' });
    }

    const results = await db
      .select()
      .from(messages)
      .where(eq(messages.swapRequestId, id))
      .orderBy(asc(messages.id));

    return res.json({ messages: results });
  } catch (err) {
    logger.error(`Fetching admin swap messages failed: ${err.message}`);
    return res.status(500).json({ error: 'Something went wrong while fetching messages' });
  }
}

async function forceSwapStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !SWAP_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${SWAP_STATUSES.join(', ')}` });
    }

    const [swapRequest] = await db.select().from(swapRequests).where(eq(swapRequests.id, id));
    if (!swapRequest) {
      return res.status(404).json({ error: 'Swap request not found' });
    }

    const [updated] = await db
      .update(swapRequests)
      .set({ status, updatedAt: new Date() })
      .where(eq(swapRequests.id, id))
      .returning();

    await db
      .insert(messages)
      .values(
        systemMessageValues(id, `An admin updated this swap request's status to ${status}.`)
      );

    return res.json({ swapRequest: updated });
  } catch (err) {
    logger.error(`Force-setting swap status failed: ${err.message}`);
    return res.status(500).json({ error: 'Something went wrong while updating the swap request' });
  }
}

async function getAnalytics(req, res) {
  try {
    const [
      [{ count: totalUsers }],
      [{ count: totalListings }],
      availabilityRows,
      statusRows,
      allUsers,
      listingCounts,
      fromCounts,
      toCounts,
    ] = await Promise.all([
      db.select({ count: sql`count(*)` }).from(users),
      db.select({ count: sql`count(*)` }).from(clothingItems),
      db
        .select({ availability: clothingItems.availability, count: sql`count(*)` })
        .from(clothingItems)
        .groupBy(clothingItems.availability),
      db
        .select({ status: swapRequests.status, count: sql`count(*)` })
        .from(swapRequests)
        .groupBy(swapRequests.status),
      db.select({ id: users.id, name: users.name }).from(users),
      db
        .select({ ownerId: clothingItems.ownerId, count: sql`count(*)` })
        .from(clothingItems)
        .groupBy(clothingItems.ownerId),
      db
        .select({ userId: swapRequests.fromUserId, count: sql`count(*)` })
        .from(swapRequests)
        .groupBy(swapRequests.fromUserId),
      db
        .select({ userId: swapRequests.toUserId, count: sql`count(*)` })
        .from(swapRequests)
        .groupBy(swapRequests.toUserId),
    ]);

    const listingsByAvailability = { available: 0, unavailable: 0 };
    for (const row of availabilityRows) {
      listingsByAvailability[row.availability] = Number(row.count);
    }

    const swapsByStatus = {};
    for (const status of SWAP_STATUSES) {
      swapsByStatus[status] = 0;
    }
    for (const row of statusRows) {
      swapsByStatus[row.status] = Number(row.count);
    }

    const activity = new Map();
    for (const user of allUsers) {
      activity.set(user.id, { userId: user.id, name: user.name, listingsCount: 0, swapsCount: 0 });
    }
    for (const row of listingCounts) {
      if (activity.has(row.ownerId)) activity.get(row.ownerId).listingsCount = Number(row.count);
    }
    for (const row of fromCounts) {
      if (activity.has(row.userId)) activity.get(row.userId).swapsCount += Number(row.count);
    }
    for (const row of toCounts) {
      if (activity.has(row.userId)) activity.get(row.userId).swapsCount += Number(row.count);
    }

    const topActiveUsers = Array.from(activity.values())
      .sort((a, b) => b.listingsCount + b.swapsCount - (a.listingsCount + a.swapsCount))
      .slice(0, 5);

    return res.json({
      totalUsers: Number(totalUsers),
      totalListings: Number(totalListings),
      listingsByAvailability,
      swapsByStatus,
      topActiveUsers,
    });
  } catch (err) {
    logger.error(`Fetching admin analytics failed: ${err.message}`);
    return res.status(500).json({ error: 'Something went wrong while fetching analytics' });
  }
}

module.exports = {
  getAllUsers,
  deactivateUser,
  activateUser,
  getAllListings,
  forceDeleteListing,
  getAllSwaps,
  getSwapMessages,
  forceSwapStatus,
  getAnalytics,
};
