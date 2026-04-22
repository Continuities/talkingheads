import Mic from "node-mic";
import RingBufferTS from "ring-buffer-ts";
import Silero from "./silero.ts";

const WINDOW_SIZE = 512;
const BUFFER_SIZE = WINDOW_SIZE * 4; // in samples, not bytes
const BITRATE = 16000;
const BITWIDTH = 16;
const BYTES_PER_SAMPLE = BITWIDTH / 8;
const INT16_MAX_MAGNITUDE = 2 ** 15; // 32768

interface Options {
  microphoneId: string;
  speechProbThreshold: number; // [0, 1]
}

export default async function MicrophoneBuffer({
  microphoneId,
  speechProbThreshold,
}: Options) {
  const detectSpeech = await Silero(BITRATE);
  const mic = new Mic({
    rate: BITRATE,
    channels: 1,
    bitwidth: BITWIDTH,
    encoding: "signed-integer",
    device: microphoneId,
  });
  const micStream = mic.getAudioStream();
  const pending = new RingBufferTS.RingBuffer<number>(BUFFER_SIZE);
  const audioBuffer = new RingBufferTS.RingBuffer<number>(BUFFER_SIZE);
  micStream.on("data", async (chunk: Buffer) => {
    const incoming = new Float32Array(chunk.length / BYTES_PER_SAMPLE);
    for (let i = 0; i < incoming.length; i++) {
      incoming[i] =
        chunk.readInt16LE(i * BYTES_PER_SAMPLE) / INT16_MAX_MAGNITUDE;
    }
    pending.add(...incoming);

    while (pending.getBufferLength() >= WINDOW_SIZE) {
      const frame = new Float32Array(pending.getFirstN(WINDOW_SIZE));
      pending.remove(0, WINDOW_SIZE);
      const speechProb = await detectSpeech(frame);
      const samples =
        speechProb >= speechProbThreshold
          ? frame
          : new Float32Array(WINDOW_SIZE);
      audioBuffer.add(...samples);
    }
  });

  mic.start();

  return audioBuffer;
}
