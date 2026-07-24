import bcrypt from "bcryptjs";

const COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * A real hash of a value nobody can supply. Compared against when the email
 * doesn't exist so a failed login costs the same time either way — otherwise
 * response latency tells an attacker which emails are registered.
 *
 * Computed once, lazily: hashing at cost 12 takes ~250ms and we don't want
 * that on module load.
 */
let dummy: string | undefined;
export function dummyHash(): string {
  return (dummy ??= bcrypt.hashSync("bluderma::no-such-account", COST));
}
