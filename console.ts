import TerminalKit from "terminal-kit";
const term = TerminalKit.terminal;

interface ConsoleData {
  speaking: boolean;
  speechProb: number;
  rms: number;
  smoothedRms: number;
  flux: number;
  solenoidOpen: boolean;
}

term.clear();

export const draw = ({
  speaking,
  speechProb,
  rms,
  smoothedRms,
  flux,
  solenoidOpen,
}: ConsoleData) => {
  term.moveTo(0, 0);
  term.table(
    [
      ["POOF", "P(speech)", "RMS", "Smoothed RMS", "Flux"],
      [
        "",
        speechProb.toFixed(3),
        rms.toFixed(3),
        smoothedRms.toFixed(3),
        flux.toFixed(3),
      ],
    ],
    {
      hasBorder: true,
      contentHasMarkup: false,
      width: 80,
      fit: true,
      firstRowTextAttr: { bgColor: "default" },
      firstColumnTextAttr: { bgColor: solenoidOpen ? "red" : "default" },
    }
  );
};
