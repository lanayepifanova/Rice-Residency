import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type BinaryLike,
  type ScryptOptions,
} from "node:crypto";

/**
 * Hand-written rather than `promisify(scrypt)`: promisify resolves to scrypt's
 * three-argument overload, which drops the options parameter that carries the
 * work factor.
 */
function scrypt(
  password: BinaryLike,
  salt: BinaryLike,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (error, derivedKey) => {
      if (error) {
        reject(error);
      } else {
        resolve(derivedKey);
      }
    });
  });
}

/**
 * Password hashing with scrypt from Node's standard library.
 *
 * scrypt is deliberately slow and memory-hard, which is the property that makes
 * a stolen hash expensive to brute-force. It ships with Node, so the app gains
 * no dependency for this — bcrypt and argon2 are both native modules that have
 * to be compiled per platform.
 */

/** Work factor. 16384 x 8 needs ~16MB per hash, and takes ~100ms on this Mac. */
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;
const KEY_BYTES = 64;
const SALT_BYTES = 16;

/** Shortest password the app will accept, checked before hashing. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Encoded as `scrypt$N$r$p$salt$key` rather than as a bare hash, so the work
 * factor travels with each stored password. Raising COST later then only
 * affects newly set passwords instead of locking everyone out.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scrypt(password.normalize("NFKC"), salt, KEY_BYTES, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELISM,
  });

  return [
    "scrypt",
    COST,
    BLOCK_SIZE,
    PARALLELISM,
    salt.toString("hex"),
    key.toString("hex"),
  ].join("$");
}

/**
 * Checks a password against a stored hash.
 *
 * Returns false rather than throwing on a malformed hash: a corrupt row should
 * deny the login, not crash the sign-in page.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");

  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }

  const [, cost, blockSize, parallelism, saltHex, keyHex] = parts;
  const expected = Buffer.from(keyHex, "hex");

  if (expected.length === 0) {
    return false;
  }

  const actual = await scrypt(
    password.normalize("NFKC"),
    Buffer.from(saltHex, "hex"),
    expected.length,
    { N: Number(cost), r: Number(blockSize), p: Number(parallelism) },
  );

  // Constant-time: a plain === leaks how many leading bytes matched, which is
  // enough to reconstruct the hash one byte at a time.
  return timingSafeEqual(actual, expected);
}
