import { KokoroTTS } from "kokoro-js";
import { parentPort, workerData } from "worker_threads";

const tts = await KokoroTTS.from_pretrained(
  "onnx-community/Kokoro-82M-v1.0-ONNX",
  {
    dtype: "q8",
    device: "cpu",
  },
);

const stanzas: string[] = workerData;

for (let i = 0; i < stanzas.length; i++) {
  const audio = await tts.generate(stanzas[i], { voice: "af_heart" });
  parentPort?.postMessage(audio.audio);
}
