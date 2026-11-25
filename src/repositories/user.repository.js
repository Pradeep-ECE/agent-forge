
import { randomUUID } from "node:crypto";
import { pool } from "../config/database.js";

export async function createUser({ email, passwordHash }) {
  const id = randomUUID();

  const query = `
    INSERT INTO users (
      id,
      email,
      password_hash
    )
    VALUES ($1, $2, $3)
    RETURNING id, email, created_at;
  `;

  const { rows } = await pool.query(query, [
    id,
    email.toLowerCase(),
    passwordHash,
  ]);

  return rows[0];
}

export async function findUserByEmail(email) {
  const query = `
    SELECT id, email, password_hash
    FROM users
    WHERE LOWER(email) = LOWER($1)
    LIMIT 1;
  `;

  const { rows } = await pool.query(query, [email]);

  return rows[0] ?? null;
}

export async function findUserById(userId) {
  const query = `
    SELECT id, email, created_at
    FROM users
    WHERE id = $1
    LIMIT 1;
  `;

  const { rows } = await pool.query(query, [userId]);

  return rows[0] ?? null;
}
