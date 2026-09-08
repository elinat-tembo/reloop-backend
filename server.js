require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const logger = require('./config/logger');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev', { stream: { write: (message) => logger.info(message.trim()) } }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
