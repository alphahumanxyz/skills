/**
 * Crypto polyfill for V8 runtime.
 * Provides Node.js crypto-like interface using Web Crypto API.
 */

import { Buffer } from './buffer.js';

/**
 * Generate random bytes synchronously.
 */
export function randomBytes(size) {
  const arr = new Uint8Array(size);
  crypto.getRandomValues(arr);
  return Buffer.from(arr);
}

/**
 * Pseudo-random bytes (alias for randomBytes in this implementation).
 */
export function pseudoRandomBytes(size) {
  return randomBytes(size);
}

/**
 * Generate a random UUID.
 */
export function randomUUID() {
  return crypto.randomUUID();
}

/**
 * Generate random integer in range [min, max).
 */
export function randomInt(min, max, callback) {
  if (typeof min === 'function') {
    callback = min;
    min = 0;
    max = 2 ** 48 - 1;
  } else if (typeof max === 'function') {
    callback = max;
    max = min;
    min = 0;
  }

  const range = max - min;
  const bytes = Math.ceil(Math.log2(range) / 8) || 1;
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);

  let value = 0;
  for (let i = 0; i < bytes; i++) {
    value = (value << 8) | arr[i];
  }
  const result = min + (value % range);

  if (callback) {
    setTimeout(() => callback(null, result), 0);
    return;
  }
  return result;
}

/**
 * Fill buffer with random bytes.
 */
export function randomFill(buffer, offset, size, callback) {
  if (typeof offset === 'function') {
    callback = offset;
    offset = 0;
    size = buffer.length;
  } else if (typeof size === 'function') {
    callback = size;
    size = buffer.length - offset;
  }

  const bytes = randomBytes(size);
  buffer.set(bytes, offset);

  if (callback) {
    setTimeout(() => callback(null, buffer), 0);
    return;
  }
  return buffer;
}

export function randomFillSync(buffer, offset = 0, size) {
  if (size === undefined) {
    size = buffer.length - offset;
  }
  const bytes = randomBytes(size);
  buffer.set(bytes, offset);
  return buffer;
}

/**
 * Simple sync hash implementation for common algorithms.
 * Note: Web Crypto's digest is async, so we provide basic implementations.
 */
class SyncHash {
  constructor(algorithm) {
    this.algorithm = algorithm.toLowerCase().replace('-', '');
    this.data = [];
  }

  update(data, encoding) {
    if (typeof data === 'string') {
      data = Buffer.from(data, encoding || 'utf8');
    } else if (!(data instanceof Uint8Array)) {
      data = Buffer.from(data);
    }
    this.data.push(data);
    return this;
  }

  digest(encoding) {
    const combined = Buffer.concat(this.data);
    let result;

    switch (this.algorithm) {
      case 'sha1':
        result = sha1(combined);
        break;
      case 'sha256':
        result = sha256(combined);
        break;
      case 'md5':
        result = md5(combined);
        break;
      default:
        throw new Error(`Unsupported hash algorithm: ${this.algorithm}`);
    }

    if (encoding) {
      return result.toString(encoding);
    }
    return result;
  }
}

/**
 * Create a hash object.
 */
export function createHash(algorithm) {
  return new SyncHash(algorithm);
}

/**
 * SHA-1 implementation.
 */
function sha1(data) {
  const msg = data instanceof Uint8Array ? data : new Uint8Array(data);
  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  // Pre-processing
  const msgLen = msg.length;
  const bitLen = msgLen * 8;
  const padLen = ((msgLen + 8) % 64 === 0 ? 64 : (64 - ((msgLen + 8) % 64))) + msgLen + 8;
  const padded = new Uint8Array(padLen);
  padded.set(msg);
  padded[msgLen] = 0x80;
  // Length in bits (big-endian)
  const view = new DataView(padded.buffer);
  view.setUint32(padLen - 4, bitLen, false);

  // Process 64-byte chunks
  const w = new Uint32Array(80);
  for (let i = 0; i < padLen; i += 64) {
    for (let j = 0; j < 16; j++) {
      w[j] = view.getUint32(i + j * 4, false);
    }
    for (let j = 16; j < 80; j++) {
      w[j] = rotl(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1);
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let j = 0; j < 80; j++) {
      let f, k;
      if (j < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (j < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (j < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const temp = (rotl(a, 5) + f + e + k + w[j]) >>> 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = temp;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  const result = Buffer.alloc(20);
  result.writeUInt32BE(h0, 0);
  result.writeUInt32BE(h1, 4);
  result.writeUInt32BE(h2, 8);
  result.writeUInt32BE(h3, 12);
  result.writeUInt32BE(h4, 16);
  return result;
}

function rotl(n, s) {
  return ((n << s) | (n >>> (32 - s))) >>> 0;
}

/**
 * SHA-256 implementation.
 */
function sha256(data) {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);

  let H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]);

  const msg = data instanceof Uint8Array ? data : new Uint8Array(data);
  const msgLen = msg.length;
  const bitLen = BigInt(msgLen) * 8n;

  // Calculate padding
  const padLen = msgLen % 64 < 56 ? 56 - (msgLen % 64) : 120 - (msgLen % 64);
  const totalLen = msgLen + padLen + 8;
  const padded = new Uint8Array(totalLen);
  padded.set(msg);
  padded[msgLen] = 0x80;

  // Append length (big-endian)
  const view = new DataView(padded.buffer);
  view.setBigUint64(totalLen - 8, bitLen, false);

  const W = new Uint32Array(64);

  for (let i = 0; i < totalLen; i += 64) {
    for (let t = 0; t < 16; t++) {
      W[t] = view.getUint32(i + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
      const s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H;

    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  const result = Buffer.alloc(32);
  for (let i = 0; i < 8; i++) {
    result.writeUInt32BE(H[i], i * 4);
  }
  return result;
}

function rotr(n, s) {
  return ((n >>> s) | (n << (32 - s))) >>> 0;
}

/**
 * MD5 implementation.
 */
function md5(data) {
  const msg = data instanceof Uint8Array ? data : new Uint8Array(data);

  const K = new Uint32Array([
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
  ]);

  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
  ];

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  // Padding
  const msgLen = msg.length;
  const bitLen = msgLen * 8;
  const padLen = msgLen % 64 < 56 ? 56 - (msgLen % 64) : 120 - (msgLen % 64);
  const totalLen = msgLen + padLen + 8;
  const padded = new Uint8Array(totalLen);
  padded.set(msg);
  padded[msgLen] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(totalLen - 8, bitLen, true);

  for (let i = 0; i < totalLen; i += 64) {
    const M = new Uint32Array(16);
    for (let j = 0; j < 16; j++) {
      M[j] = view.getUint32(i + j * 4, true);
    }

    let A = a0, B = b0, C = c0, D = d0;

    for (let j = 0; j < 64; j++) {
      let F, g;
      if (j < 16) {
        F = (B & C) | (~B & D);
        g = j;
      } else if (j < 32) {
        F = (D & B) | (~D & C);
        g = (5 * j + 1) % 16;
      } else if (j < 48) {
        F = B ^ C ^ D;
        g = (3 * j + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * j) % 16;
      }
      F = (F + A + K[j] + M[g]) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + rotl(F, S[j])) >>> 0;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const result = Buffer.alloc(16);
  result.writeUInt32LE(a0, 0);
  result.writeUInt32LE(b0, 4);
  result.writeUInt32LE(c0, 8);
  result.writeUInt32LE(d0, 12);
  return result;
}

/**
 * HMAC implementation.
 */
class Hmac {
  constructor(algorithm, key) {
    this.algorithm = algorithm;
    this.blockSize = algorithm === 'sha256' ? 64 : 64;

    if (typeof key === 'string') {
      key = Buffer.from(key);
    }

    if (key.length > this.blockSize) {
      key = createHash(algorithm).update(key).digest();
    }

    this.key = Buffer.alloc(this.blockSize);
    this.key.set(key);

    this.inner = createHash(algorithm);
    this.outer = createHash(algorithm);

    const ipad = Buffer.alloc(this.blockSize, 0x36);
    const opad = Buffer.alloc(this.blockSize, 0x5c);

    for (let i = 0; i < this.blockSize; i++) {
      ipad[i] ^= this.key[i];
      opad[i] ^= this.key[i];
    }

    this.inner.update(ipad);
    this.outer.update(opad);
  }

  update(data, encoding) {
    this.inner.update(data, encoding);
    return this;
  }

  digest(encoding) {
    const innerHash = this.inner.digest();
    this.outer.update(innerHash);
    return this.outer.digest(encoding);
  }
}

export function createHmac(algorithm, key) {
  return new Hmac(algorithm, key);
}

/**
 * PBKDF2 implementation.
 */
export function pbkdf2Sync(password, salt, iterations, keylen, digest = 'sha256') {
  if (typeof password === 'string') password = Buffer.from(password);
  if (typeof salt === 'string') salt = Buffer.from(salt);

  const hashLen = digest === 'sha256' ? 32 : digest === 'sha1' ? 20 : 16;
  const numBlocks = Math.ceil(keylen / hashLen);
  const result = Buffer.alloc(numBlocks * hashLen);

  for (let i = 1; i <= numBlocks; i++) {
    const blockNum = Buffer.alloc(4);
    blockNum.writeUInt32BE(i, 0);

    let U = createHmac(digest, password)
      .update(Buffer.concat([salt, blockNum]))
      .digest();
    let F = U;

    for (let j = 1; j < iterations; j++) {
      U = createHmac(digest, password).update(U).digest();
      for (let k = 0; k < hashLen; k++) {
        F[k] ^= U[k];
      }
    }

    result.set(F, (i - 1) * hashLen);
  }

  return result.subarray(0, keylen);
}

export function pbkdf2(password, salt, iterations, keylen, digest, callback) {
  try {
    const result = pbkdf2Sync(password, salt, iterations, keylen, digest);
    setTimeout(() => callback(null, result), 0);
  } catch (e) {
    setTimeout(() => callback(e), 0);
  }
}

/**
 * Cipher/Decipher stubs - These require complex implementations.
 * For gramjs, AES-IGE and AES-CTR are handled separately.
 */
export function createCipheriv(algorithm, key, iv) {
  throw new Error(`createCipheriv not implemented for ${algorithm}`);
}

export function createDecipheriv(algorithm, key, iv) {
  throw new Error(`createDecipheriv not implemented for ${algorithm}`);
}

// Export constants
export const constants = {
  SSL_OP_ALL: 0,
  SSL_OP_NO_SSLv2: 0,
  SSL_OP_NO_SSLv3: 0,
  SSL_OP_NO_TLSv1: 0,
};

// Default export
export default {
  randomBytes,
  pseudoRandomBytes,
  randomUUID,
  randomInt,
  randomFill,
  randomFillSync,
  createHash,
  createHmac,
  pbkdf2,
  pbkdf2Sync,
  createCipheriv,
  createDecipheriv,
  constants,
};
