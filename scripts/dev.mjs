import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const editorPort = process.env.VAULT_EDITOR_PORT ?? "3211";
const nextArgs = process.argv.slice(2);

function option(args, long, short) {
  const equals = args.find((value) => value.startsWith(`${long}=`));
  if (equals) return equals.slice(long.length + 1);
  const index = args.findIndex((value) => value === long || value === short);
  return index === -1 ? undefined : args[index + 1];
}

const nextPort = option(nextArgs, "--port", "-p") ?? process.env.PORT ?? "3000";
if (!/^\d+$/.test(editorPort) || Number(editorPort) < 1 || Number(editorPort) > 65_535) {
  throw new TypeError("VAULT_EDITOR_PORT must be a valid TCP port");
}
if (!/^\d+$/.test(nextPort) || Number(nextPort) < 1 || Number(nextPort) > 65_535) {
  throw new TypeError("The Next.js development port must be valid");
}
const protocol = nextArgs.includes("--experimental-https") ? "https" : "http";
const env = {
  ...process.env,
  VAULT_EDITOR_PORT: editorPort,
  VAULT_EDITOR_ORIGIN: new URL(`${protocol}://localhost:${nextPort}`).origin,
};
const children = new Set();
let stopping = false;

function start(label, command, args) {
  const child = spawn(command, args, { cwd: root, env, stdio: "inherit" });
  children.add(child);
  child.once("exit", (code, signal) => {
    children.delete(child);
    if (stopping) return;
    stopping = true;
    for (const peer of children) peer.kill("SIGTERM");
    if (signal) process.kill(process.pid, signal);
    else process.exitCode = code ?? 1;
    if ((code ?? 0) !== 0) console.error(`[dev] ${label} exited with code ${code}`);
  });
  return child;
}

start("vault editor", process.execPath, [path.join(root, "scripts", "dev-editor.mjs")]);
start("Next.js", process.execPath, [
  path.join(root, "node_modules", "next", "dist", "bin", "next"),
  "dev",
  ...nextArgs,
]);

function stop(signal) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill(signal);
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
