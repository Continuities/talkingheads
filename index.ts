import Mic from "node-mic";
import RingBufferTS from "ring-buffer-ts";
import Silero from "./silero.ts";
import { smoothed } from "./util.ts";
import { draw } from "./console.ts";
import Solenoid from "./solenoid.ts";

const WINDOW_SIZE = 512;
const BUFFER_SIZE = WINDOW_SIZE * 4; // in samples, not bytes
const BITRATE = 16000;
const BITWIDTH = 16;
const BYTES_PER_SAMPLE = BITWIDTH / 8;
const INT16_MAX_MAGNITUDE = 2 ** 15; // 32768
const PROCESSING_INTERVAL_MS = 50;
const RMS_SMOOTHING = 0.3; // [0, 1] higher = smoother, but more lag; 0 = no smoothing, more jitter
const SPEECH_PROB_THRESHOLD = 0.75; // [0, 1] threshold for speech detection
const ONSET_THRESHOLD = 0.01; // rms delta for syllable detection. Tune to the mic.
const MIN_ONSET_GAP_MS = 150; // minimum ms between onsets
const FLUX_SCALE = 10; // how much flux (rms increase) maps to max strength

const detectSpeech = await Silero(BITRATE);
const smoothedRMS = smoothed(RMS_SMOOTHING, 0);
const solenoid = Solenoid({
  minTriggerDelayMs: MIN_ONSET_GAP_MS,
  maxOpenDurationMs: 500,
});

const mic = new Mic({
  rate: BITRATE,
  channels: 1,
  bitwidth: BITWIDTH,
  encoding: "signed-integer",
});
const micStream = mic.getAudioStream();
const audioBuffer = new RingBufferTS.RingBuffer<number>(BUFFER_SIZE);

micStream.on("data", (chunk: Buffer) => {
  const incoming = new Float32Array(chunk.length / BYTES_PER_SAMPLE);
  for (let i = 0; i < incoming.length; i++) {
    incoming[i] = chunk.readInt16LE(i * BYTES_PER_SAMPLE) / INT16_MAX_MAGNITUDE;
  }
  audioBuffer.add(...incoming);
});

mic.start();

(async function processAudio() {
  setTimeout(processAudio, PROCESSING_INTERVAL_MS);
  while (audioBuffer.getBufferLength() >= WINDOW_SIZE) {
    const frame = new Float32Array(audioBuffer.getFirstN(WINDOW_SIZE));
    audioBuffer.remove(0, WINDOW_SIZE);
    const rms = Math.sqrt(frame.reduce((s, x) => s + x * x, 0) / frame.length);
    const flux = Math.max(0, rms - smoothedRMS.value()); // only care about increases
    const onsetTriggered = flux > ONSET_THRESHOLD;
    const smoothed = smoothedRMS.update(rms);
    const speechProb = await detectSpeech(frame);
    const speaking = speechProb > SPEECH_PROB_THRESHOLD;

    if (speaking && onsetTriggered) {
      const strength = Math.min(1, flux * FLUX_SCALE);
      solenoid.trigger(strength);
    }

    draw({
      speaking,
      speechProb,
      rms,
      smoothedRms: smoothed,
      flux,
      solenoidOpen: solenoid.isOpen(),
    });
  }
})();
