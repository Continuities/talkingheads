import { draw } from "./console.ts";
import Head from "./head.ts";

const CONSOLE_FPS = 30;
const RMS_SMOOTHING = 0.3; // [0, 1] higher = smoother, but more lag; 0 = no smoothing, more jitter
const SPEECH_PROB_THRESHOLD = 0.75; // [0, 1] threshold for speech detection
const ONSET_THRESHOLD = 0.01; // rms delta for syllable detection. Tune to the mic.
const MIN_ONSET_GAP_MS = 150; // minimum ms between onsets
const FLUX_SCALE = 10; // how much flux (rms increase) maps to max strength

const heads = await Promise.all([
  Head({
    microphoneId: "default",
    rmsSmoothing: RMS_SMOOTHING,
    speechProbThreshold: SPEECH_PROB_THRESHOLD,
    onsetThreshold: ONSET_THRESHOLD,
    minOnsetGapMs: MIN_ONSET_GAP_MS,
    fluxScale: FLUX_SCALE,
  }),
  Head({
    microphoneId: "default",
    rmsSmoothing: RMS_SMOOTHING,
    speechProbThreshold: SPEECH_PROB_THRESHOLD,
    onsetThreshold: ONSET_THRESHOLD,
    minOnsetGapMs: MIN_ONSET_GAP_MS,
    fluxScale: FLUX_SCALE,
  }),
]);

(function drawLoop() {
  setTimeout(drawLoop, 1000 / CONSOLE_FPS);
  draw(heads.map((h) => h.info()));
})();
