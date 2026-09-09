const dns = require('dns');

// Some hosting environments don't have a working IPv6 route, which can make
// outbound HTTPS calls to Neon intermittently hang/time out on the IPv6
// attempt before falling back to IPv4. Prefer IPv4 resolution to avoid that.
dns.setDefaultResultOrder('ipv4first');

const { neon } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-http');

const schema = require('./schema');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
}

const sql = neon(process.env.DATABASE_URL);

const db = drizzle(sql, { schema });

module.exports = { db, sql };
