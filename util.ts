export function rmsToDb(rms: number): number {
  if (rms === 0) return -Infinity;
  return 20 * Math.log10(rms); // returns dBFS (0 = max, negative = quieter)
}

export function calculateRMS(buffer: Buffer): number {
  // node-mic gives raw PCM bytes — interpret as 16-bit signed integers
  const samples = buffer.length / 2; // 2 bytes per 16-bit sample
  let sumOfSquares = 0;

  for (let i = 0; i < buffer.length; i += 2) {
    // Read a 16-bit little-endian signed integer
    const sample = buffer.readInt16LE(i) / 32768; // normalize to [-1.0, 1.0]
    sumOfSquares += sample * sample;
  }

  return Math.sqrt(sumOfSquares / samples);
}
