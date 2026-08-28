import process from "node:process";
import { createDevEditorServer } from "./dev-editor-server.mjs";

const repoRoot = process.cwd();
const port = Number(process.env.VAULT_EDITOR_PORT ?? 3211);
const expectedOrigin = process.env.VAULT_EDITOR_ORIGIN ?? "http://localhost:3000";
if (process.env.NODE_ENV === "production") {
  throw new Error("The vault editor refuses to start in production mode");
}
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
  throw new TypeError("VAULT_EDITOR_PORT must be a valid TCP port");
}
const server = createDevEditorServer({ repoRoot, expectedOrigin });

server.listen(port, "127.0.0.1", () => {
  console.log(`[vault-editor] localhost-only writer ready on 127.0.0.1:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
