/**
 * @cryptography/aes polyfill for V8 runtime.
 * Implements AES-256 encryption that gramjs uses for MTProto.
 *
 * This is a minimal implementation using Web Crypto API primitives.
 * gramjs uses AES in ECB mode for key schedule operations.
 */

// S-box and inverse S-box for AES
const SBOX = new Uint8Array([
  0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
  0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
  0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
  0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
  0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
  0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
  0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
  0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
  0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
  0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
  0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
  0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
  0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
  0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
  0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
  0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16,
]);

// Round constants for key expansion
const RCON = new Uint32Array([
  0x01000000, 0x02000000, 0x04000000, 0x08000000, 0x10000000, 0x20000000, 0x40000000, 0x80000000,
  0x1b000000, 0x36000000,
]);

// Galois field multiplication
function gmul(a, b) {
  let p = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) p ^= a;
    const hi = a & 0x80;
    a = (a << 1) & 0xff;
    if (hi) a ^= 0x1b;
    b >>= 1;
  }
  return p;
}

// Pre-compute multiplication tables
const MUL2 = new Uint8Array(256);
const MUL3 = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  MUL2[i] = gmul(i, 2);
  MUL3[i] = gmul(i, 3);
}

class AES {
  constructor(key) {
    // key is expected to be an array of 32-bit words
    this.keyWords = key;
    this.keySize = key.length; // 4, 6, or 8 words for AES-128, 192, 256
    this.rounds = this.keySize + 6; // 10, 12, or 14 rounds
    this.expandedKey = this.expandKey(key);
  }

  expandKey(key) {
    const nk = this.keySize;
    const nr = this.rounds;
    const expanded = new Uint32Array(4 * (nr + 1));

    // Copy the original key
    for (let i = 0; i < nk; i++) {
      expanded[i] = key[i];
    }

    // Expand the key
    for (let i = nk; i < 4 * (nr + 1); i++) {
      let temp = expanded[i - 1];

      if (i % nk === 0) {
        // RotWord and SubWord
        temp =
          ((SBOX[(temp >> 16) & 0xff] << 24) |
            (SBOX[(temp >> 8) & 0xff] << 16) |
            (SBOX[temp & 0xff] << 8) |
            SBOX[(temp >> 24) & 0xff]) ^
          RCON[Math.floor(i / nk) - 1];
      } else if (nk > 6 && i % nk === 4) {
        // SubWord for AES-256
        temp =
          (SBOX[(temp >> 24) & 0xff] << 24) |
          (SBOX[(temp >> 16) & 0xff] << 16) |
          (SBOX[(temp >> 8) & 0xff] << 8) |
          SBOX[temp & 0xff];
      }

      expanded[i] = expanded[i - nk] ^ temp;
    }

    return expanded;
  }

  encrypt(block) {
    // block is expected to be an array of 4 32-bit words
    const state = new Uint32Array(block);
    const w = this.expandedKey;

    // Initial round key addition
    for (let i = 0; i < 4; i++) {
      state[i] ^= w[i];
    }

    // Main rounds
    for (let round = 1; round < this.rounds; round++) {
      this.subBytes(state);
      this.shiftRows(state);
      this.mixColumns(state);
      for (let i = 0; i < 4; i++) {
        state[i] ^= w[round * 4 + i];
      }
    }

    // Final round (no MixColumns)
    this.subBytes(state);
    this.shiftRows(state);
    for (let i = 0; i < 4; i++) {
      state[i] ^= w[this.rounds * 4 + i];
    }

    return Array.from(state);
  }

  subBytes(state) {
    for (let i = 0; i < 4; i++) {
      state[i] =
        (SBOX[(state[i] >> 24) & 0xff] << 24) |
        (SBOX[(state[i] >> 16) & 0xff] << 16) |
        (SBOX[(state[i] >> 8) & 0xff] << 8) |
        SBOX[state[i] & 0xff];
    }
  }

  shiftRows(state) {
    // Extract bytes from the state (column-major order)
    const s = new Uint8Array(16);
    for (let col = 0; col < 4; col++) {
      s[col * 4] = (state[col] >> 24) & 0xff;
      s[col * 4 + 1] = (state[col] >> 16) & 0xff;
      s[col * 4 + 2] = (state[col] >> 8) & 0xff;
      s[col * 4 + 3] = state[col] & 0xff;
    }

    // Shift rows
    // Row 1: shift left by 1
    let t = s[1];
    s[1] = s[5];
    s[5] = s[9];
    s[9] = s[13];
    s[13] = t;

    // Row 2: shift left by 2
    t = s[2];
    s[2] = s[10];
    s[10] = t;
    t = s[6];
    s[6] = s[14];
    s[14] = t;

    // Row 3: shift left by 3 (same as right by 1)
    t = s[15];
    s[15] = s[11];
    s[11] = s[7];
    s[7] = s[3];
    s[3] = t;

    // Put back into state
    for (let col = 0; col < 4; col++) {
      state[col] =
        (s[col * 4] << 24) | (s[col * 4 + 1] << 16) | (s[col * 4 + 2] << 8) | s[col * 4 + 3];
    }
  }

  mixColumns(state) {
    for (let col = 0; col < 4; col++) {
      const s0 = (state[col] >> 24) & 0xff;
      const s1 = (state[col] >> 16) & 0xff;
      const s2 = (state[col] >> 8) & 0xff;
      const s3 = state[col] & 0xff;

      state[col] =
        ((MUL2[s0] ^ MUL3[s1] ^ s2 ^ s3) << 24) |
        ((s0 ^ MUL2[s1] ^ MUL3[s2] ^ s3) << 16) |
        ((s0 ^ s1 ^ MUL2[s2] ^ MUL3[s3]) << 8) |
        (MUL3[s0] ^ s1 ^ s2 ^ MUL2[s3]);
    }
  }
}

export default AES;
export { AES };
