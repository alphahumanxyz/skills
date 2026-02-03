/**
 * big-integer polyfill using native BigInt.
 * gramjs was transitioned from big-integer library to native BigInt,
 * but this provides compatibility if any remaining references exist.
 */

function bigInt(value, radix) {
  if (value === undefined) return 0n;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(Math.floor(value));
  if (typeof value === 'string') {
    if (radix) {
      return BigInt(parseInt(value, radix));
    }
    // Handle hex strings
    if (value.startsWith('0x') || value.startsWith('0X')) {
      return BigInt(value);
    }
    // Handle negative strings
    if (value.startsWith('-')) {
      return BigInt(value);
    }
    return BigInt(value);
  }
  if (value instanceof Uint8Array || Array.isArray(value)) {
    let result = 0n;
    for (let i = 0; i < value.length; i++) {
      result = (result << 8n) | BigInt(value[i]);
    }
    return result;
  }
  return BigInt(value);
}

// Static methods
bigInt.zero = 0n;
bigInt.one = 1n;
bigInt.minusOne = -1n;

bigInt.fromArray = function (digits, base = 10, isNegative = false) {
  let result = 0n;
  const bigBase = BigInt(base);
  for (const digit of digits) {
    result = result * bigBase + BigInt(digit);
  }
  return isNegative ? -result : result;
};

bigInt.gcd = function (a, b) {
  a = bigInt(a);
  b = bigInt(b);
  if (a < 0n) a = -a;
  if (b < 0n) b = -b;
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a;
};

bigInt.lcm = function (a, b) {
  a = bigInt(a);
  b = bigInt(b);
  return (a * b) / bigInt.gcd(a, b);
};

bigInt.isInstance = function (x) {
  return typeof x === 'bigint';
};

bigInt.max = function (...args) {
  return args.map(bigInt).reduce((a, b) => (a > b ? a : b));
};

bigInt.min = function (...args) {
  return args.map(bigInt).reduce((a, b) => (a < b ? a : b));
};

bigInt.randBetween = function (min, max) {
  min = bigInt(min);
  max = bigInt(max);
  const range = max - min;
  const bits = range.toString(2).length;
  const bytes = Math.ceil(bits / 8);
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  let result = 0n;
  for (const byte of arr) {
    result = (result << 8n) | BigInt(byte);
  }
  return min + (result % (range + 1n));
};

export default bigInt;
export { bigInt };
