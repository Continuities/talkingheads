import ort from "onnxruntime-node";
import { lerp } from "./util.ts";

const WINDOW_SIZE = 512;
const HOP_SIZE = 256;
const BYTES_PER_SAMPLE = 2;

const ONSET_THRESHOLD = 0.1; // tune this
const MIN_ONSET_GAP_MS = 150; // minimum ms between onsets
const SMOOTH = 0.15; // smoothing factor for energy envelope

export default async (sampleRate: number) => {
  let session: ort.InferenceSession;
  let h: ort.Tensor;
  let c: ort.Tensor;
  let smoothedRms: number = 0;
  let lastOnsetTime: number = 0;

  async function init() {
    session = await ort.InferenceSession.create("./silero_vad_4.onnx");
    resetState();
  }

  function resetState() {
    h = new ort.Tensor("float32", new Float32Array(2 * 1 * 64), [2, 1, 64]);
    c = new ort.Tensor("float32", new Float32Array(2 * 1 * 64), [2, 1, 64]);
  }

  async function detectSpeech(
    float32Chunk: Float32Array<ArrayBuffer>
  ): Promise<number> {
    const input = new ort.Tensor("float32", float32Chunk, [
      1,
      float32Chunk.length,
    ]);
    const sr = new ort.Tensor(
      "int64",
      BigInt64Array.from([BigInt(sampleRate)]),
      [1]
    );

    const result = await session.run({ input, sr, h, c });
    h = result.hn;
    c = result.cn;

    return result.output.data[0] as number; // speech probability 0.0 – 1.0
  }

  function detectOnset(float32: Float32Array): boolean {
    const rms = Math.sqrt(
      float32.reduce((s, x) => s + x * x, 0) / float32.length
    );

    // How much did energy just jump?
    const flux = Math.max(0, rms - smoothedRms); // only care about increases
    smoothedRms = SMOOTH * smoothedRms + (1 - SMOOTH) * rms;

    const now = Date.now();
    const gapOk = now - lastOnsetTime > MIN_ONSET_GAP_MS;

    if (flux > ONSET_THRESHOLD && gapOk) {
      lastOnsetTime = now;
      return true;
    }
    return false;
  }

  await init();

  let ringBuffer = new Float32Array(WINDOW_SIZE);
  let samplesInRing = 0;

  return async (chunk: Buffer) => {
    // Convert incoming bytes to float32
    const incoming = new Float32Array(chunk.length / BYTES_PER_SAMPLE);
    for (let i = 0; i < incoming.length; i++) {
      incoming[i] = chunk.readInt16LE(i * BYTES_PER_SAMPLE) / 32768;
    }

    let offset = 0;
    while (offset < incoming.length) {
      const spaceInRing = WINDOW_SIZE - samplesInRing;
      const samplesAvailable = incoming.length - offset;
      const toCopy = Math.min(spaceInRing, samplesAvailable);

      ringBuffer.set(incoming.subarray(offset, offset + toCopy), samplesInRing);
      samplesInRing += toCopy;
      offset += toCopy;

      if (samplesInRing === WINDOW_SIZE) {
        // Log audio statistics before inference
        const min = Math.min(...ringBuffer);
        const max = Math.max(...ringBuffer);
        const rms = Math.sqrt(
          ringBuffer.reduce((s, x) => s + x * x, 0) / WINDOW_SIZE
        );

        const probability = await detectSpeech(new Float32Array(ringBuffer));
        const isSpeech = probability > 0.75;
        const isOnset = detectOnset(ringBuffer);

        if (isSpeech && isOnset) {
          const duration = Math.floor(lerp(50, 300, smoothedRms / 0.3));
          console.log("poof ", duration);
        }

        // Retain second half for next window
        ringBuffer.copyWithin(0, HOP_SIZE);
        samplesInRing = WINDOW_SIZE - HOP_SIZE;
      }
    }
  };
};
