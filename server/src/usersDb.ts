export interface UserRow {
  id: number
  email: string
  password_hash: string
  password_salt: string
  created_at: string
}

export async function findUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  const row = await db
    .prepare(`SELECT * FROM users WHERE email = ?`)
    .bind(email.trim().toLowerCase())
    .first<UserRow>()
  return row ?? null
}
