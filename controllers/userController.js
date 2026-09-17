const bcrypt = require('bcrypt');
const { eq } = require('drizzle-orm');

const { db } = require('../db');
const { users } = require('../db/schema');
const logger = require('../config/logger');

const SALT_ROUNDS = 10;

const PUBLIC_PROFILE_COLUMNS = {
  id: users.id,
  name: users.name,
  email: users.email,
  contactDetails: users.contactDetails,
  role: users.role,
  isActive: users.isActive,
  createdAt: users.createdAt,
};

async function updateProfile(req, res) {
  try {
    const { name, contactDetails } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const [updated] = await db
      .update(users)
      .set({ name, contactDetails: contactDetails || null, updatedAt: new Date() })
      .where(eq(users.id, req.user.id))
      .returning(PUBLIC_PROFILE_COLUMNS);

    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user: updated });
  } catch (err) {
    logger.error(`Update profile failed: ${err.message}`);
    return res.status(500).json({ error: 'Something went wrong while updating your profile' });
  }
}

async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }

    const [user] = await db.select().from(users).where(eq(users.id, req.user.id));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const passwordMatches = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await db
      .update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, req.user.id));

    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    logger.error(`Change password failed: ${err.message}`);
    return res.status(500).json({ error: 'Something went wrong while updating your password' });
  }
}

module.exports = { updateProfile, changePassword };
