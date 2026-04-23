import { Worker } from "worker_threads";
import Speaker from "speaker";
import { readFile } from "node:fs/promises";
import RingBufferTS from "ring-buffer-ts";

const SAMPLE_RATE = 24000;
const CHANNELS = 1;
const BUFFER_SIZE = SAMPLE_RATE * 60 * 5; // in samples, not bytes, enough for 5 minutes of audio

function float32ToInt16Buffer(float32Array: Float32Array) {
  const int16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float32Array[i]));
    int16[i] = clamped * 0x7fff;
  }
  return Buffer.from(int16.buffer);
}

export default async function KokoroBuffer(
  inputFile: string,
  numSpeakers = 1,
): Promise<RingBufferTS.RingBuffer<number>[]> {
  let currentSpeaker = 0;
  const outputBuffers = Array.from(
    { length: numSpeakers },
    () => new RingBufferTS.RingBuffer<number>(BUFFER_SIZE),
  );

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
        for (let i = 0; i < numSpeakers; i++) {
          outputBuffers[i].add(i === currentSpeaker ? sample : 0);
        }
      }
    }
  });

  const text = await readFile(inputFile, "utf-8");

  const stanzas = text
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const worker = new Worker("./kokoro-worker.ts", {
    workerData: {
      stanzas,
      numSpeakers,
    },
  });

  worker.on("message", (audio: ArrayBuffer) => {
    const samples = new Float32Array(audio);
    speaker.write(float32ToInt16Buffer(samples));
    if (speakerReady) {
      for (const sample of samples) {
        for (let i = 0; i < numSpeakers; i++) {
          outputBuffers[i].add(i === currentSpeaker ? sample : 0);
        }
      }
    } else {
      pending.push(samples);
    }
    currentSpeaker = (currentSpeaker + 1) % numSpeakers;
  });

  worker.on("error", (err) => {
    console.error("Worker error:", err);
  });

  worker.on("exit", (code) => {
    speaker.end();
  });

  return outputBuffers;
}
