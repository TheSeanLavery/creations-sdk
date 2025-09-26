// Simple deterministic PRNG (xorshift32) with seed derivation

export function createRng(seed) {
  let s = (seed >>> 0) || 1
  function nextU32() {
    // xorshift32
    s ^= s << 13; s >>>= 0
    s ^= s >>> 17; s >>>= 0
    s ^= s << 5; s >>>= 0
    return s >>> 0
  }
  return {
    next() { return (nextU32() >>> 0) / 0xffffffff }, // [0,1)
    nextRange(min, max) { return min + (max - min) * ((nextU32() >>> 0) / 0xffffffff) },
    nextInt(min, max) { return Math.floor(createRng.mix(nextU32()) % (max - min + 1)) + min },
    get state() { return s >>> 0 },
  }
}

// Derive a child seed from parent seed and a label
export function deriveSeed(parentSeed, label) {
  let h = (parentSeed >>> 0) ^ 0x9e3779b9
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i) + 0x9e3779b97f4a7c15 + (h << 6) + (h >>> 2)
    h >>>= 0
  }
  return h >>> 0
}


