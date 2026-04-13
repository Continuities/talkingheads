import { draw } from "./console.ts";
import Head from "./head.ts";
import { SerialPort, ReadlineParser } from "serialport";

if (!process.env.SERIAL_PATH) {
  throw "Environment SERIAL_PATH missing";
}

const CONSOLE_FPS = 30;
const RMS_SMOOTHING = 0.3; // [0, 1] higher = smoother, but more lag; 0 = no smoothing, more jitter
const SPEECH_PROB_THRESHOLD = 0.75; // [0, 1] threshold for speech detection
const ONSET_THRESHOLD = 0.001; // rms delta for syllable detection. Tune to the mic.
const MIN_ONSET_GAP_MS = 150; // minimum ms between onsets
const FLUX_SCALE = 20; // how much flux (rms increase) maps to max strength
const SERIAL_BAUD = 9600;

const port = new SerialPort({
  path: process.env.SERIAL_PATH,
  baudRate: SERIAL_BAUD,
});
const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));
const serialLogArray: string[] = [];
const serialLog = (msg) => {
  const timestring = new Date().toISOString();
  serialLogArray.push(`${timestring} ${msg}`);
  if (serialLogArray.length > 10) {
    serialLogArray.shift();
  }
};
port.on("open", () => {
  serialLog(`Serial connected at ${process.env.SERIAL_PATH}`);
});
parser.on("data", (data) => {
  serialLog(`[RX] ${data}`);
});

const sendSerial = (msg: string) => {
  port.write(`${msg}\n`, (err) => {
    if (err) {
      serialLog(`[ERR] ${err}`);
      return;
    }
    serialLog(`[TX] ${msg}`);
  });
};

const headConfigs = [];
if (process.env.MICROPHONE_1_ID) {
  headConfigs.push({
    microphoneId: process.env.MICROPHONE_1_ID,
    rmsSmoothing: RMS_SMOOTHING,
    speechProbThreshold: SPEECH_PROB_THRESHOLD,
    onsetThreshold: ONSET_THRESHOLD,
    minOnsetGapMs: MIN_ONSET_GAP_MS,
    fluxScale: FLUX_SCALE,
    setSolenoid: (open) => {
      sendSerial(`0:${open ? "1" : "0"}`);
    },
  });
}
if (process.env.MICROPHONE_2_ID) {
  headConfigs.push({
    microphoneId: process.env.MICROPHONE_2_ID,
    rmsSmoothing: RMS_SMOOTHING,
    speechProbThreshold: SPEECH_PROB_THRESHOLD,
    onsetThreshold: ONSET_THRESHOLD,
    minOnsetGapMs: MIN_ONSET_GAP_MS,
    fluxScale: FLUX_SCALE,
    setSolenoid: (open) => {
      sendSerial(`1:${open ? "1" : "0"}`);
    },
  });
}

const heads = await Promise.all(headConfigs.map(Head));

(function drawLoop() {
  setTimeout(drawLoop, 1000 / CONSOLE_FPS);
  draw(
    heads.map((h) => h.info()),
    serialLogArray,
  );
})();
