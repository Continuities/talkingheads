import RingBufferTS from "ring-buffer-ts";
import { smoothed } from "./util.ts";
import Solenoid from "./solenoid.ts";

const WINDOW_SIZE = 512;

export interface HeadInfo {
  rms: number;
  smoothedRms: number;
  flux: number;
  solenoidOpen: boolean;
}

export interface HeadConfig {
  audioBuffer: RingBufferTS.RingBuffer<number>;
  solenoid: ReturnType<typeof Solenoid>;
  rmsSmoothing: number;
  onsetThreshold: number;
  fluxScale: number;
  bitrate: number;
}

export default async function Head({
  audioBuffer,
  solenoid,
  rmsSmoothing,
  onsetThreshold,
  fluxScale,
  bitrate,
}: HeadConfig) {
  let currentInfo: HeadInfo = {
    rms: 0,
    smoothedRms: 0,
    flux: 0,
    solenoidOpen: false,
  };
  const processInterval = Math.round((WINDOW_SIZE / bitrate) * 1000);
  const smoothedRMS = smoothed(rmsSmoothing, 0);
  (async function processAudio() {
    setTimeout(processAudio, processInterval);
    if (audioBuffer.getBufferLength() >= WINDOW_SIZE) {
      const frame = new Float32Array(audioBuffer.getFirstN(WINDOW_SIZE));
      audioBuffer.remove(0, WINDOW_SIZE);
      const rms = Math.sqrt(
        frame.reduce((s, x) => s + x * x, 0) / frame.length,
      );
      const flux = Math.max(0, rms - smoothedRMS.value()); // only care about increases
      const onsetTriggered = flux > onsetThreshold;
      const smoothed = smoothedRMS.update(rms);

      if (onsetTriggered) {
        const strength = Math.min(1, flux * fluxScale);
        solenoid.trigger(strength);
      }

      currentInfo = {
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
}
