import { draw } from "./console.ts";
import Head, { type HeadConfig } from "./head.ts";
import { SerialPort, ReadlineParser } from "serialport";
import createSerial from "./serial.ts";

if (!process.env.SERIAL_PATH) {
  console.warn(
    "Environment SERIAL_PATH missing, running without serial connection",
  );
}
if (!process.env.FLUX_SCALE) {
  throw "Environment FLUX_SCALE missing";
}
if (!process.env.ONSET_THRESHOLD) {
  throw "Environment ONSET_THRESHOLD missing";
}

const CONSOLE_FPS = 30;
const RMS_SMOOTHING = 0.3; // [0, 1] higher = smoother, but more lag; 0 = no smoothing, more jitter
const SPEECH_PROB_THRESHOLD = 0.75; // [0, 1] threshold for speech detection
const MIN_ONSET_GAP_MS = 150; // minimum ms between onsets
const SERIAL_BAUD = 9600;

const serial = process.env.SERIAL_PATH
  ? createSerial({
      path: process.env.SERIAL_PATH,
      baudRate: SERIAL_BAUD,
    })
  : null;

const headConfigs: HeadConfig[] = [];
if (process.env.MICROPHONE_1_ID) {
  headConfigs.push({
    microphoneId: process.env.MICROPHONE_1_ID,
    rmsSmoothing: RMS_SMOOTHING,
    speechProbThreshold: SPEECH_PROB_THRESHOLD,
    onsetThreshold: parseInt(process.env.ONSET_THRESHOLD, 10),
    minOnsetGapMs: MIN_ONSET_GAP_MS,
    fluxScale: parseInt(process.env.FLUX_SCALE, 10),
    setSolenoid: (open) => {
      serial?.sendSerial(`0:${open ? "1" : "0"}`);
    },
  });
}
if (process.env.MICROPHONE_2_ID) {
  headConfigs.push({
    microphoneId: process.env.MICROPHONE_2_ID,
    rmsSmoothing: RMS_SMOOTHING,
    speechProbThreshold: SPEECH_PROB_THRESHOLD,
    onsetThreshold: parseInt(process.env.ONSET_THRESHOLD, 10),
    minOnsetGapMs: MIN_ONSET_GAP_MS,
    fluxScale: parseInt(process.env.FLUX_SCALE, 10),
    setSolenoid: (open) => {
      serial?.sendSerial(`1:${open ? "1" : "0"}`);
    },
  });
}

const heads = await Promise.all(headConfigs.map(Head));

(function drawLoop() {
  setTimeout(drawLoop, 1000 / CONSOLE_FPS);
  draw(
    heads.map((h) => h.info()),
    serial?.serialLogArray ?? [],
  );
})();
