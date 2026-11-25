
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import {
  createUser,
  findUserByEmail,
} from "../repositories/user.repository.js";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}

// Register new user
export async function registerUser({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await createUser({
      email: normalizedEmail,
      passwordHash,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
      },
    };
  } catch (error) {
    if (error.code === "23505") {
      throw new Error("EMAIL_ALREADY_EXISTS");
    }

    throw error;
  }
}

// Login existing user
export async function loginUser({ email, password }) {
  const user = await findUserByEmail(email.trim().toLowerCase());

  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const passwordMatches = await bcrypt.compare(
    password,
    user.password_hash
  );

  if (!passwordMatches) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const accessToken = jwt.sign(
    {
      sub: user.id,
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
      issuer: "agentforge",
      audience: "agentforge-api",
    }
  );

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    accessToken,
    tokenType: "Bearer",
    expiresIn: JWT_EXPIRES_IN,
  };
}
