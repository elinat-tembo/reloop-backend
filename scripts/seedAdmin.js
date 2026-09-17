// Creates a single admin user from the ADMIN_EMAIL / ADMIN_PASSWORD values in .env.
// Run with: node scripts/seedAdmin.js
require('dotenv').config();

const bcrypt = require('bcrypt');
const { eq } = require('drizzle-orm');

const { db } = require('../db');
const { users } = require('../db/schema');

const SALT_ROUNDS = 10;

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
    process.exit(1);
  }

  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) {
    console.log(`User ${email} already exists (id: ${existing.id}). No changes made.`);
    process.exit(0);
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const [admin] = await db
    .insert(users)
    .values({
      name: 'Admin',
      email,
      password: hashedPassword,
      role: 'admin',
    })
    .returning({ id: users.id, name: users.name, email: users.email, role: users.role });

  console.log('Admin user created:', admin);
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error('Failed to seed admin user:', err);
  process.exit(1);
});
