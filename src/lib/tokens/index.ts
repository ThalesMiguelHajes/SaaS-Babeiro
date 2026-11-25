import "server-only";

import { createHash, randomBytes } from "node:crypto";

/**
 * Tokens privados (convites, gestão de reserva): 256 bits aleatórios em base64url.
 * Apenas o hash SHA-256 é armazenado no banco (SECURITY.md §7).
 */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Hash SHA-256 em hexadecimal no formato bytea do Postgres (`\x...`). */
export function hashTokenForDb(token: string): string {
  return `\\x${createHash("sha256").update(token, "utf8").digest("hex")}`;
}

export function isWellFormedToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
