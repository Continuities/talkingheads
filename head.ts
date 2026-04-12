import Mic from "node-mic";
import RingBufferTS from "ring-buffer-ts";
import Silero from "./silero.ts";
import { smoothed } from "./util.ts";
import Solenoid from "./solenoid.ts";

const WINDOW_SIZE = 512;
const BUFFER_SIZE = WINDOW_SIZE * 4; // in samples, not bytes
const BITRATE = 16000;
const BITWIDTH = 16;
const BYTES_PER_SAMPLE = BITWIDTH / 8;
const INT16_MAX_MAGNITUDE = 2 ** 15; // 32768
const PROCESSING_INTERVAL_MS = 50;

interface HeadConfig {
  microphoneId: string; // e.g. "hw:1,0"
  rmsSmoothing: number; // [0, 1] higher = smoother, but more lag; 0 = no smoothing, more jitter
  speechProbThreshold: number; // [0, 1] threshold for speech detection
  onsetThreshold: number; // rms delta for syllable detection. Tune to the mic.
  minOnsetGapMs: number; // minimum ms between onsets
  fluxScale: number; // how much flux (rms increase) maps to max strength
}

export interface HeadInfo {
  speaking: boolean;
  speechProb: number;
  rms: number;
  smoothedRms: number;
  flux: number;
  solenoidOpen: boolean;
}

export default async ({
  microphoneId,
  rmsSmoothing,
  speechProbThreshold,
  onsetThreshold,
  minOnsetGapMs,
  fluxScale,
}: HeadConfig) => {
  const detectSpeech = await Silero(BITRATE);
  const smoothedRMS = smoothed(rmsSmoothing, 0);
  const solenoid = Solenoid({
    minTriggerDelayMs: minOnsetGapMs,
    maxOpenDurationMs: 500,
  });
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

  let currentInfo: HeadInfo = {
    speaking: false,
    speechProb: 0,
    rms: 0,
    smoothedRms: 0,
    flux: 0,
    solenoidOpen: false,
  };
  (async function processAudio() {
    setTimeout(processAudio, PROCESSING_INTERVAL_MS);
    while (audioBuffer.getBufferLength() >= WINDOW_SIZE) {
      const frame = new Float32Array(audioBuffer.getFirstN(WINDOW_SIZE));
      audioBuffer.remove(0, WINDOW_SIZE);
      const rms = Math.sqrt(
        frame.reduce((s, x) => s + x * x, 0) / frame.length
      );
      const flux = Math.max(0, rms - smoothedRMS.value()); // only care about increases
      const onsetTriggered = flux > onsetThreshold;
      const smoothed = smoothedRMS.update(rms);
      const speechProb = await detectSpeech(frame);
      const speaking = speechProb > speechProbThreshold;

      if (speaking && onsetTriggered) {
        const strength = Math.min(1, flux * fluxScale);
        solenoid.trigger(strength);
      }

      currentInfo = {
        speaking,
        speechProb,
        rms,
        smoothedRms: smoothed,
        flux,
        solenoidOpen: solenoid.isOpen(),
      };
    }
  })();

  return {
    info: () => currentInfo,
  };
};
