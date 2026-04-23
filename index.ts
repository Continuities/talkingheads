import { draw } from "./console.ts";
import Head, { type HeadConfig } from "./head.ts";
import createSerial from "./serial.ts";
import MicrophoneBuffer from "./microphone-buffer.ts";
import Solenoid from "./solenoid.ts";
import KokoroBuffer from "./kokoro-buffer.ts";

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
const MAX_SOLENOID_OPEN_DURATION_MS = 500; // how long to open the solenoid for, at max strength
const SERIAL_BAUD = 9600;

const serial = process.env.SERIAL_PATH
  ? createSerial({
      path: process.env.SERIAL_PATH,
      baudRate: SERIAL_BAUD,
    })
  : null;

const headConfigs: HeadConfig[] = [];
if (process.env.MICROPHONE_1_ID) {
  const mic1 = await MicrophoneBuffer({
    microphoneId: process.env.MICROPHONE_1_ID,
    speechProbThreshold: SPEECH_PROB_THRESHOLD,
  });
  const solenoid = Solenoid({
    minTriggerDelayMs: MIN_ONSET_GAP_MS,
    maxOpenDurationMs: MAX_SOLENOID_OPEN_DURATION_MS,
    onChange: (open) => {
      serial?.sendSerial(`0:${open ? "1" : "0"}`);
    },
  });
  headConfigs.push({
    audioBuffer: mic1,
    bitrate: 16000,
    solenoid,
    rmsSmoothing: RMS_SMOOTHING,
    onsetThreshold: parseFloat(process.env.ONSET_THRESHOLD),
    fluxScale: parseFloat(process.env.FLUX_SCALE),
  });
}
if (process.env.TEXT_INPUT_FILE) {
  const [buffer1, buffer2] = await KokoroBuffer(process.env.TEXT_INPUT_FILE, 2);
  const solenoid1 = Solenoid({
    minTriggerDelayMs: MIN_ONSET_GAP_MS,
    maxOpenDurationMs: MAX_SOLENOID_OPEN_DURATION_MS,
    onChange: (open) => {
      serial?.sendSerial(`1:${open ? "1" : "0"}`);
    },
  });
  const solenoid2 = Solenoid({
    minTriggerDelayMs: MIN_ONSET_GAP_MS,
    maxOpenDurationMs: MAX_SOLENOID_OPEN_DURATION_MS,
    onChange: (open) => {
      serial?.sendSerial(`2:${open ? "1" : "0"}`);
    },
  });
  headConfigs.push({
    audioBuffer: buffer1,
    bitrate: 24000,
    solenoid: solenoid1,
    rmsSmoothing: RMS_SMOOTHING,
    onsetThreshold: parseFloat(process.env.ONSET_THRESHOLD),
    fluxScale: parseFloat(process.env.FLUX_SCALE),
  });
  headConfigs.push({
    audioBuffer: buffer2,
    bitrate: 24000,
    solenoid: solenoid2,
    rmsSmoothing: RMS_SMOOTHING,
    onsetThreshold: parseFloat(process.env.ONSET_THRESHOLD),
    fluxScale: parseFloat(process.env.FLUX_SCALE),
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
