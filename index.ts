import Mic from "node-mic";
// import handler from "./vad.ts";
import handler from "./silero.ts";

const BITRATE = 16000;
const mic = new Mic({
  rate: BITRATE,
  channels: 1,
  bitwidth: 16,
  encoding: "signed-integer",
});
const micStream = mic.getAudioStream();

const vadHandler = await handler(BITRATE);

micStream.on("data", vadHandler);

mic.start();
