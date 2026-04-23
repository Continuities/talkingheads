import { KokoroTTS } from "kokoro-js";
import { parentPort, workerData } from "worker_threads";

const tts = await KokoroTTS.from_pretrained(
  "onnx-community/Kokoro-82M-v1.0-ONNX",
  {
    dtype: "q8",
    device: "cpu",
  },
);

const { stanzas, numSpeakers }: { stanzas: string[]; numSpeakers: number } =
  workerData;

const allVoices = Object.entries(tts.voices);
const voices: Array<keyof typeof tts.voices> = [];
for (let i = 0; i < numSpeakers; i++) {
  const voice = allVoices.splice(
    Math.floor(Math.random() * allVoices.length),
    1,
  )[0][0] as keyof typeof tts.voices;
  voices.push(voice);
}

for (let i = 0; i < stanzas.length; i++) {
  const audio = await tts.generate(stanzas[i], {
    voice: voices[i % voices.length],
  });
  parentPort?.postMessage(audio.audio);
}
