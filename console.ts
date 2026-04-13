import TerminalKit from "terminal-kit";
import { type HeadInfo } from "./head.ts";

const term = TerminalKit.terminal;

term.clear();

export const draw = (heads: HeadInfo[], serialLog: string[]) => {
  const rows = heads.map((h, i) => [
    `${i + 1}`,
    h.solenoidOpen ? "^#^r    ^:" : "    ",
    h.speechProb.toFixed(3),
    h.rms.toFixed(3),
    h.smoothedRms.toFixed(3),
    h.flux.toFixed(3),
  ]);
  term.moveTo(0, 0);
  term.table(
    [["Head", "POOF", "P(speech)", "RMS", "Smoothed RMS", "Flux"], ...rows],
    {
      hasBorder: true,
      contentHasMarkup: true,
      width: 80,
      fit: true,
    },
  );
  term.table([["Serial log"], [serialLog.join("\n")]]);
};
