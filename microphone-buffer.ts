import Mic from "node-mic";
import RingBufferTS from "ring-buffer-ts";

const WINDOW_SIZE = 512;
const BUFFER_SIZE = WINDOW_SIZE * 4; // in samples, not bytes
const BITRATE = 16000;
const BITWIDTH = 16;
const BYTES_PER_SAMPLE = BITWIDTH / 8;
const INT16_MAX_MAGNITUDE = 2 ** 15; // 32768

export default function MicrophoneBuffer(microphoneId: string) {
  const mic = new Mic({
    rate: BITRATE,
    channels: 1,
    bitwidth: BITWIDTH,
    encoding: "signed-integer",
    device: microphoneId,
  });
  const micStream = mic.getAudioStream();
  const audioBuffer = new RingBufferTS.RingBuffer<number>(BUFFER_SIZE);
  micStream.on("data", (chunk: Buffer) => {
    const incoming = new Float32Array(chunk.length / BYTES_PER_SAMPLE);
    for (let i = 0; i < incoming.length; i++) {
      incoming[i] =
        chunk.readInt16LE(i * BYTES_PER_SAMPLE) / INT16_MAX_MAGNITUDE;
    }
    audioBuffer.add(...incoming);
  });

  mic.start();

  return audioBuffer;
}
