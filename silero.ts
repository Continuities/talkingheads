import ort from "onnxruntime-node";

export default async (sampleRate: number) => {
  let session: ort.InferenceSession;
  let h: ort.Tensor;
  let c: ort.Tensor;

  async function init() {
    session = await ort.InferenceSession.create("./silero_vad_4.onnx");
    resetState();
  }

  function resetState() {
    h = new ort.Tensor("float32", new Float32Array(2 * 1 * 64), [2, 1, 64]);
    c = new ort.Tensor("float32", new Float32Array(2 * 1 * 64), [2, 1, 64]);
  }

  async function detectSpeech(
    float32Chunk: Float32Array<ArrayBuffer>
  ): Promise<number> {
    const input = new ort.Tensor("float32", float32Chunk, [
      1,
      float32Chunk.length,
    ]);
    const sr = new ort.Tensor(
      "int64",
      BigInt64Array.from([BigInt(sampleRate)]),
      [1]
    );

    const result = await session.run({ input, sr, h, c });
    h = result.hn;
    c = result.cn;

    return result.output.data[0] as number; // speech probability 0.0 – 1.0
  }

  await init();

  return detectSpeech;
};
