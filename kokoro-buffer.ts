import { Worker } from "worker_threads";
import Speaker from "speaker";
import { readFile } from "node:fs/promises";
import RingBufferTS from "ring-buffer-ts";

const SAMPLE_RATE = 24000;
const CHANNELS = 1;

function float32ToInt16Buffer(float32Array: Float32Array) {
  const int16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float32Array[i]));
    int16[i] = clamped * 0x7fff;
  }
  return Buffer.from(int16.buffer);
}

export default async function KokoroBuffer(inputFile: string) {
  const outputBuffer: RingBufferTS.RingBuffer<number> =
    new RingBufferTS.RingBuffer(SAMPLE_RATE * 10); // 10 seconds buffer

  const speaker = new Speaker({
    channels: CHANNELS,
    bitDepth: 16,
    sampleRate: SAMPLE_RATE,
  });

  let speakerReady = false;
  const pending: Float32Array[] = [];
  speaker.on("open", () => {
    speakerReady = true;
    for (const chunk of pending) {
      for (const sample of chunk) {
        outputBuffer.add(sample);
      }
    }
  });

  const text = await readFile(inputFile, "utf-8");

  const stanzas = text
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const worker = new Worker("./kokoro-worker.ts", {
    workerData: stanzas,
  });

  worker.on("message", (audio: ArrayBuffer) => {
    const samples = new Float32Array(audio);
    speaker.write(float32ToInt16Buffer(samples));
    if (speakerReady) {
      for (const sample of samples) {
        outputBuffer.add(sample);
      }
    } else {
      pending.push(samples);
    }
  });

  worker.on("error", (err) => {
    console.error("Worker error:", err);
  });

  worker.on("exit", (code) => {
    speaker.end();
  });

  return outputBuffer;
}
