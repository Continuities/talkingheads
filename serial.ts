import { ReadlineParser, SerialPort } from "serialport";

export default ({ path, baudRate }: { path: string; baudRate: number }) => {
  const port = new SerialPort({
    path,
    baudRate,
  });
  const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));
  const serialLogArray: string[] = [];
  const serialLog = (msg: string) => {
    const timestring = new Date().toISOString();
    serialLogArray.push(`${timestring} ${msg}`);
    if (serialLogArray.length > 10) {
      serialLogArray.shift();
    }
  };
  port.on("open", () => {
    serialLog(`Serial connected at ${path}`);
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
  return { sendSerial, serialLogArray };
};
