import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const strictScript = fileURLToPath(new URL("./smoke-customizer-photo-true-v5-strict.mjs", import.meta.url));
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 2_000;

function runStrictAcceptance() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [strictScript], {
      stdio: "inherit",
      env: process.env,
    });
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
}

let lastResult = { code: 1, signal: null };
for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
  console.log(`Photo-True V5 strict acceptance attempt ${attempt}/${MAX_ATTEMPTS}`);
  lastResult = await runStrictAcceptance();
  if (lastResult.code === 0 && !lastResult.signal) process.exit(0);
  if (attempt < MAX_ATTEMPTS) {
    console.warn(`Photo-True V5 strict acceptance attempt ${attempt} failed; retrying once after ${RETRY_DELAY_MS}ms.`);
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }
}

console.error(`Photo-True V5 strict acceptance failed after ${MAX_ATTEMPTS} attempts.`, lastResult);
process.exit(lastResult.code || 1);
