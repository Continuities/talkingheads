import VAD from "node-vad";

export default async (bitrate: number) => {
  const vad = new VAD(VAD.Mode.VERY_AGGRESSIVE);
  return async (chunk: Buffer) => {
    const result = await vad.processAudio(chunk, bitrate);
    if (result === VAD.Event.VOICE) {
      console.log("Speech detected");
    }
    if (result === VAD.Event.SILENCE) {
      console.log("Silence");
    }
  };
};
