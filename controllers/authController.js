const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { eq } = require('drizzle-orm');

const { db } = require('../db');
const { users } = require('../db/schema');
const logger = require('../config/logger');

const SALT_ROUNDS = 10;

async function register(req, res) {
  try {
    const { name, email, password, contactDetails } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password are required' });
    }

    const existing = await db.select().from(users).where(eq(users.email, email));
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email is already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    await db.insert(users).values({
      name,
      email,
      password: hashedPassword,
      contactDetails: contactDetails || null,
    });

    return res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    logger.error(`Register failed: ${err.message}`);
    return res.status(500).json({ error: 'Something went wrong during registration' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    logger.error(`Login failed: ${err.message}`);
    return res.status(500).json({ error: 'Something went wrong during login' });
  }
}

async function me(req, res) {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.user.id));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { password, ...userInfo } = user;
    return res.json({ user: userInfo });
  } catch (err) {
    logger.error(`Fetching current user failed: ${err.message}`);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

module.exports = { register, login, me };
