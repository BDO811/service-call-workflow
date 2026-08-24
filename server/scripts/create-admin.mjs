#!/usr/bin/env node
// Hashes an admin's email/password with the same PBKDF2-SHA256 algorithm the
// Worker verifies against (see src/passwords.ts), then prints a SQL INSERT
// statement for the `users` table. Nothing here ever leaves your machine —
// the password itself is never sent anywhere, only its hash+salt.
//
// Usage:
//   node scripts/create-admin.mjs "you@example.com" "your-password" > /tmp/add-admin.sql
//   npx wrangler d1 execute service-call-workflow-db --remote --file=/tmp/add-admin.sql
//
// Run it again with a different email to add more admins later.

const ITERATIONS = 100_000

function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256,
  )
  return { hash: toHex(bits), salt: toHex(salt) }
}

function sqlEscape(value) {
  return value.replace(/'/g, "''")
}

const [, , email, password] = process.argv
if (!email || !password) {
  console.error('Usage: node scripts/create-admin.mjs "you@example.com" "your-password"')
  process.exit(1)
}

const { hash, salt } = await hashPassword(password)
const normalizedEmail = sqlEscape(email.trim().toLowerCase())
console.log(
  `INSERT INTO users (email, password_hash, password_salt) VALUES ('${normalizedEmail}', '${hash}', '${salt}');`,
)
