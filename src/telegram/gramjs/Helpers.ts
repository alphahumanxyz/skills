import crypto from 'crypto';

import type { EntityLike } from './define';
import { isNode } from './platform';
import type { Api } from './tl';

/**
 * Helper function to calculate bit length of a bigint
 */
function bitLength(n: bigint): number {
  if (n === 0n) return 0;
  return n.toString(2).length;
}

/**
 * converts a buffer to big int
 * @param buffer
 * @param little
 * @param signed
 * @returns {bigint}
 */
export function readBigIntFromBuffer(
  buffer: Buffer,
  little = true,
  signed = false
): bigint {
  let randBuffer = Buffer.from(buffer);
  const bytesNumber = randBuffer.length;
  if (little) {
    randBuffer = randBuffer.reverse();
  }
  let bigIntVar = BigInt('0x' + randBuffer.toString('hex'));

  if (signed && Math.floor(bitLength(bigIntVar) / 8) >= bytesNumber) {
    bigIntVar = bigIntVar - (2n ** BigInt(bytesNumber * 8));
  }
  return bigIntVar;
}

export function generateRandomBigInt() {
  return readBigIntFromBuffer(generateRandomBytes(8), false);
}

export function escapeRegex(string: string) {
  return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

export function groupBy(list: any[], keyGetter: Function) {
  const map = new Map();
  list.forEach(item => {
    const key = keyGetter(item);
    const collection = map.get(key);
    if (!collection) {
      map.set(key, [item]);
    } else {
      collection.push(item);
    }
  });
  return map;
}

/**
 * Outputs the object in a better way by hiding all the private methods/attributes.
 * @param object - the class to use
 */
export function betterConsoleLog(object: { [key: string]: any }) {
  const toPrint: { [key: string]: any } = {};
  for (const key in object) {
    if (object.hasOwnProperty(key)) {
      if (!key.startsWith('_') && key != 'originalArgs') {
        toPrint[key] = object[key];
      }
    }
  }
  return toPrint;
}

/**
 * Helper to find if a given object is an array (or similar)
 */
export const isArrayLike = <T>(x: any): x is Array<T> =>
  x && typeof x.length === 'number' && typeof x !== 'function' && typeof x !== 'string';

/*
export function addSurrogate(text: string) {
    let temp = "";
    for (const letter of text) {
        const t = letter.charCodeAt(0);
        if (0x1000 < t && t < 0x10FFFF) {
            const b = Buffer.from(letter, "utf16le");
            const r = String.fromCharCode(b.readUInt16LE(0)) + String.fromCharCode(b.readUInt16LE(2));
            temp += r;
        } else {
            text += letter;
        }
    }
    return temp;
}

 */

/**
 * Special case signed little ints
 * @param big
 * @param number
 * @returns {Buffer}
 */
export function toSignedLittleBuffer(big: bigint | string | number, number = 8): Buffer {
  const bigNumber = returnBigInt(big);
  const byteArray: number[] = [];
  for (let i = 0; i < number; i++) {
    byteArray[i] = Number((bigNumber >> BigInt(8 * i)) & 255n);
  }
  return Buffer.from(byteArray);
}

/**
 * converts a big int to a buffer
 * @param bigIntVar {bigint}
 * @param bytesNumber
 * @param little
 * @param signed
 * @returns {Buffer}
 */
export function readBufferFromBigInt(
  bigIntVar: bigint,
  bytesNumber: number,
  little = true,
  signed = false
): Buffer {
  bigIntVar = BigInt(bigIntVar);
  const bits = bitLength(bigIntVar);

  const bytes = Math.ceil(bits / 8);
  if (bytesNumber < bytes) {
    throw new Error('OverflowError: int too big to convert');
  }
  if (!signed && bigIntVar < 0n) {
    throw new Error('Cannot convert to unsigned');
  }

  if (signed && bigIntVar < 0n) {
    bigIntVar = (2n ** BigInt(bytesNumber * 8)) + bigIntVar;
  }

  const hex = bigIntVar.toString(16).padStart(bytesNumber * 2, '0');
  let buffer = Buffer.from(hex, 'hex');

  if (little) {
    buffer = buffer.reverse();
  }

  return buffer;
}

/**
 * Generates a random long integer (8 bytes), which is optionally signed
 * @returns {BigInteger}
 */
export function generateRandomLong(signed = true) {
  return readBigIntFromBuffer(generateRandomBytes(8), true, signed);
}

/**
 * .... really javascript
 * @param n {number}
 * @param m {number}
 * @returns {number}
 */
export function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

/**
 * returns a positive bigInt
 * @param n {bigint}
 * @param m {bigint}
 * @returns {bigint}
 */
export function bigIntMod(n: bigint, m: bigint): bigint {
  return ((n % m) + m) % m;
}

/**
 * Generates a random bytes array
 * @param count
 * @returns {Buffer}
 */
export function generateRandomBytes(count: number) {
  return Buffer.from(crypto.randomBytes(count));
}

/**
 * Calculate the key based on Telegram guidelines, specifying whether it's the client or not
 * @param sharedKey
 * @param msgKey
 * @param client
 * @returns {{iv: Buffer, key: Buffer}}
 */

/*CONTEST
this is mtproto 1 (mostly used for secret chats)
async function calcKey(sharedKey, msgKey, client) {
    const x = client === true ? 0 : 8
    const [sha1a, sha1b, sha1c, sha1d] = await Promise.all([
        sha1(Buffer.concat([msgKey, sharedKey.slice(x, x + 32)])),
        sha1(Buffer.concat([sharedKey.slice(x + 32, x + 48), msgKey, sharedKey.slice(x + 48, x + 64)])),
        sha1(Buffer.concat([sharedKey.slice(x + 64, x + 96), msgKey])),
        sha1(Buffer.concat([msgKey, sharedKey.slice(x + 96, x + 128)]))
    ])
    const key = Buffer.concat([sha1a.slice(0, 8), sha1b.slice(8, 20), sha1c.slice(4, 16)])
    const iv = Buffer.concat([sha1a.slice(8, 20), sha1b.slice(0, 8), sha1c.slice(16, 20), sha1d.slice(0, 8)])
    return {
        key,
        iv
    }
}

 */
export function stripText(text: string, entities: Api.TypeMessageEntity[]) {
  if (!entities || !entities.length) {
    return text.trim();
  }
  while (text && text[text.length - 1].trim() === '') {
    const e = entities[entities.length - 1];
    if (e.offset + e.length == text.length) {
      if (e.length == 1) {
        entities.pop();
        if (!entities.length) {
          return text.trim();
        }
      } else {
        e.length -= 1;
      }
    }
    text = text.slice(0, -1);
  }
  while (text && text[0].trim() === '') {
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (e.offset != 0) {
        e.offset--;
        continue;
      }
      if (e.length == 1) {
        entities.shift();
        if (!entities.length) {
          return text.trimLeft();
        }
      } else {
        e.length -= 1;
      }
    }
    text = text.slice(1);
  }
  return text;
}

/**
 * Generates the key data corresponding to the given nonces
 * @param serverNonceBigInt
 * @param newNonceBigInt
 * @returns {{key: Buffer, iv: Buffer}}
 */
export async function generateKeyDataFromNonce(
  serverNonceBigInt: bigint,
  newNonceBigInt: bigint
) {
  const serverNonce = toSignedLittleBuffer(serverNonceBigInt, 16);
  const newNonce = toSignedLittleBuffer(newNonceBigInt, 32);
  const [hash1, hash2, hash3] = await Promise.all([
    sha1(Buffer.concat([newNonce, serverNonce])),
    sha1(Buffer.concat([serverNonce, newNonce])),
    sha1(Buffer.concat([newNonce, newNonce])),
  ]);
  const keyBuffer = Buffer.concat([hash1, hash2.slice(0, 12)]);
  const ivBuffer = Buffer.concat([hash2.slice(12, 20), hash3, newNonce.slice(0, 4)]);
  return { key: keyBuffer, iv: ivBuffer };
}

export function convertToLittle(buf: Buffer) {
  const correct = Buffer.alloc(buf.length * 4);

  for (let i = 0; i < buf.length; i++) {
    correct.writeUInt32BE(buf[i], i * 4);
  }
  return correct;
}

/**
 * Calculates the SHA1 digest for the given data
 * @param data
 * @returns {Promise}
 */
export function sha1(data: Buffer): Promise<Buffer> {
  const shaSum = crypto.createHash('sha1');
  shaSum.update(data);
  // @ts-ignore
  return shaSum.digest();
}

/**
 * Calculates the SHA256 digest for the given data
 * @param data
 * @returns {Promise}
 */
export function sha256(data: Buffer): Promise<Buffer> {
  const shaSum = crypto.createHash('sha256');
  shaSum.update(data);
  // @ts-ignore
  return shaSum.digest();
}

/**
 * Fast mod pow for RSA calculation. a^b % n
 * @param a
 * @param b
 * @param n
 * @returns {bigint}
 */
export function modExp(
  a: bigint,
  b: bigint,
  n: bigint
): bigint {
  a = a % n;
  let result = 1n;
  let x = a;
  while (b > 0n) {
    const leastSignificantBit = b % 2n;
    b = b / 2n;
    if (leastSignificantBit === 1n) {
      result = (result * x) % n;
    }
    x = (x * x) % n;
  }
  return result;
}

/**
 * Gets the arbitrary-length byte array corresponding to the given integer
 * @param integer {number,bigint}
 * @param signed {boolean}
 * @returns {Buffer}
 */
export function getByteArray(integer: bigint | number, signed = false) {
  const bits = typeof integer === 'number' ? integer.toString(2).length : bitLength(integer);
  const byteLength = Math.floor((bits + 8 - 1) / 8);
  return readBufferFromBigInt(
    typeof integer == 'number' ? BigInt(integer) : integer,
    byteLength,
    false,
    signed
  );
}

export function returnBigInt(num: bigint | string | number): bigint {
  if (typeof num === 'bigint') {
    return num;
  }
  if (typeof num == 'number') {
    return BigInt(num);
  }
  return BigInt(num);
}

/**
 * Helper function to return the smaller big int in an array
 * @param arrayOfBigInts
 */
export function getMinBigInt(arrayOfBigInts: (bigint | string)[]): bigint {
  if (arrayOfBigInts.length == 0) {
    return 0n;
  }
  if (arrayOfBigInts.length == 1) {
    return returnBigInt(arrayOfBigInts[0]);
  }
  let smallest = returnBigInt(arrayOfBigInts[0]);
  for (let i = 1; i < arrayOfBigInts.length; i++) {
    const current = returnBigInt(arrayOfBigInts[i]);
    if (current < smallest) {
      smallest = current;
    }
  }
  return smallest;
}

/**
 * returns a random int from min (inclusive) and max (inclusive)
 * @param min
 * @param max
 * @returns {number}
 */
export function getRandomInt(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sleeps a specified amount of time
 * @param ms time in milliseconds
 * @param isUnref make a timer unref'ed
 * @returns {Promise}
 */
export const sleep = (ms: number, isUnref: boolean = false) =>
  new Promise(resolve =>
    isUnref && isNode ? setTimeout(resolve, ms).unref() : setTimeout(resolve, ms)
  );

/**
 * Helper to export two buffers of same length
 * @returns {Buffer}
 */

export function bufferXor(a: Buffer, b: Buffer) {
  const res: number[] = [];
  for (let i = 0; i < a.length; i++) {
    res.push(a[i] ^ b[i]);
  }
  return Buffer.from(res);
}

// Taken from https://stackoverflow.com/questions/18638900/javascript-crc32/18639999#18639999
function makeCRCTable() {
  let c;
  const crcTable: number[] = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c;
  }
  return crcTable;
}

let crcTable: number[] | undefined = undefined;

export function crc32(buf: Buffer | string) {
  if (!crcTable) {
    crcTable = makeCRCTable();
  }
  if (!Buffer.isBuffer(buf)) {
    buf = Buffer.from(buf);
  }
  let crc = -1;

  for (let index = 0; index < buf.length; index++) {
    const byte = buf[index];
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

export class TotalList<T> extends Array<T> {
  public total?: number;

  constructor() {
    super();
    this.total = 0;
  }
}

export const _EntityType = { USER: 0, CHAT: 1, CHANNEL: 2 };
Object.freeze(_EntityType);

export function _entityType(entity: EntityLike) {
  if (typeof entity !== 'object' || !('SUBCLASS_OF_ID' in entity)) {
    throw new Error(`${entity} is not a TLObject, cannot determine entity type`);
  }
  if (
    ![
      0x2d45687, // crc32('Peer')
      0xc91c90b6, // crc32('InputPeer')
      0xe669bf46, // crc32('InputUser')
      0x40f202fd, // crc32('InputChannel')
      0x2da17977, // crc32('User')
      0xc5af5d94, // crc32('Chat')
      0x1f4661b9, // crc32('UserFull')
      0xd49a2697, // crc32('ChatFull')
    ].includes(entity.SUBCLASS_OF_ID)
  ) {
    throw new Error(`${entity} does not have any entity type`);
  }
  const name = entity.className;
  if (name.includes('User')) {
    return _EntityType.USER;
  } else if (name.includes('Chat')) {
    return _EntityType.CHAT;
  } else if (name.includes('Channel')) {
    return _EntityType.CHANNEL;
  } else if (name.includes('Self')) {
    return _EntityType.USER;
  }
  // 'Empty' in name or not found, we don't care, not a valid entity.
  throw new Error(`${entity} does not have any entity type`);
}
