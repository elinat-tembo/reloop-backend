const { eq, and, or } = require('drizzle-orm');

const { db } = require('../db');
const { clothingItems, swapRequests } = require('../db/schema');
const { CATEGORIES } = require('../constants/categories');
const logger = require('../config/logger');

async function createListing(req, res) {
  try {
    const { type, brand, size, condition, estimatedValue, images, city, region } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'type is required' });
    }

    if (!CATEGORIES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${CATEGORIES.join(', ')}` });
    }

    const [listing] = await db
      .insert(clothingItems)
      .values({
        ownerId: req.user.id,
        type,
        brand: brand || null,
        size: size || null,
        condition: condition || null,
        estimatedValue: estimatedValue ?? null,
        images: images || null,
        city: city || null,
        region: region || null,
      })
      .returning();

    return res.status(201).json({ listing });
  } catch (err) {
    logger.error(`Create listing failed: ${err.message}`);
    return res.status(500).json({ error: 'Something went wrong while creating the listing' });
  }
}

async function getListings(req, res) {
  try {
    const { city, region, type, condition } = req.query;

    const conditions = [];
    if (city) conditions.push(eq(clothingItems.city, city));
    if (region) conditions.push(eq(clothingItems.region, region));
    if (type) conditions.push(eq(clothingItems.type, type));
    if (condition) conditions.push(eq(clothingItems.condition, condition));

    const query = db.select().from(clothingItems);
    const listings = conditions.length > 0 ? await query.where(and(...conditions)) : await query;

    return res.json({ listings });
  } catch (err) {
    logger.error(`Fetching listings failed: ${err.message}`);
    return res.status(500).json({ error: 'Something went wrong while fetching listings' });
  }
}

async function getMyListings(req, res) {
  try {
    const listings = await db
      .select()
      .from(clothingItems)
      .where(eq(clothingItems.ownerId, req.user.id));

    return res.json({ listings });
  } catch (err) {
    logger.error(`Fetching own listings failed: ${err.message}`);
    return res.status(500).json({ error: 'Something went wrong while fetching your listings' });
  }
}

async function getListingById(req, res) {
  try {
    const { id } = req.params;

    const [listing] = await db.select().from(clothingItems).where(eq(clothingItems.id, id));
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    return res.json({ listing });
  } catch (err) {
    logger.error(`Fetching listing failed: ${err.message}`);
    return res.status(500).json({ error: 'Something went wrong while fetching the listing' });
  }
}

async function updateListing(req, res) {
  try {
    const { id } = req.params;

    const [listing] = await db.select().from(clothingItems).where(eq(clothingItems.id, id));
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to update this listing' });
    }

    const { type, brand, size, condition, estimatedValue, images, city, region, availability } =
      req.body;

    if (type !== undefined && !CATEGORIES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${CATEGORIES.join(', ')}` });
    }

    const updates = { updatedAt: new Date() };
    if (type !== undefined) updates.type = type;
    if (brand !== undefined) updates.brand = brand;
    if (size !== undefined) updates.size = size;
    if (condition !== undefined) updates.condition = condition;
    if (estimatedValue !== undefined) updates.estimatedValue = estimatedValue;
    if (images !== undefined) updates.images = images;
    if (city !== undefined) updates.city = city;
    if (region !== undefined) updates.region = region;
    if (availability !== undefined) updates.availability = availability;

    const [updated] = await db
      .update(clothingItems)
      .set(updates)
      .where(eq(clothingItems.id, id))
      .returning();

    return res.json({ listing: updated });
  } catch (err) {
    logger.error(`Update listing failed: ${err.message}`);
    return res.status(500).json({ error: 'Something went wrong while updating the listing' });
  }
}

async function deleteListing(req, res) {
  try {
    const { id } = req.params;

    const [listing] = await db.select().from(clothingItems).where(eq(clothingItems.id, id));
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to delete this listing' });
    }

    const [pendingRequest] = await db
      .select()
      .from(swapRequests)
      .where(
        and(
          or(eq(swapRequests.requestedItemId, id), eq(swapRequests.offeredItemId, id)),
          eq(swapRequests.status, 'pending')
        )
      );

    if (pendingRequest) {
      return res
        .status(409)
        .json({ error: 'Cancel the pending swap request before deleting this item.' });
    }

    await db.delete(clothingItems).where(eq(clothingItems.id, id));

    return res.json({ message: 'Listing deleted successfully' });
  } catch (err) {
    logger.error(`Delete listing failed: ${err.message}`);
    return res.status(500).json({ error: 'Something went wrong while deleting the listing' });
  }
}

module.exports = {
  createListing,
  getListings,
  getMyListings,
  getListingById,
  updateListing,
  deleteListing,
};
