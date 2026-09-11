require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { sql: neonSql } = require('drizzle-orm');

const logger = require('./config/logger');
const { db } = require('./db');
const { users } = require('./db/schema');
const authRoutes = require('./routes/auth');
const listingRoutes = require('./routes/listings');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev', { stream: { write: (message) => logger.info(message.trim()) } }));

app.use('/api/auth', authRoutes);
app.use('/api/listings', listingRoutes);

app.get('/api/health', async (req, res) => {
  try {
    const result = await db.select({ count: neonSql`count(*)` }).from(users);
    const userCount = Number(result[0]?.count ?? 0);
    res.json({ status: 'ok', db: 'connected', userCount });
  } catch (err) {
    logger.error(`Health check DB query failed: ${err.message}`);
    res.status(500).json({ status: 'ok', db: 'error', error: err.message });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
