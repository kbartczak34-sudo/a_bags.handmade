import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const strictScript = fileURLToPath(new URL("./smoke-customizer-photo-true-v5.mjs", import.meta.url));
const maxAttempts = 2;
const retryDelayMs = 2_000;

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
for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  console.log(`Photo-True V5 strict acceptance attempt ${attempt}/${maxAttempts}`);
  lastResult = await runStrictAcceptance();
  if (lastResult.code === 0 && !lastResult.signal) process.exit(0);
  if (attempt < maxAttempts) {
    console.warn(`Photo-True V5 strict acceptance attempt ${attempt} failed; retrying once after ${retryDelayMs}ms.`);
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }
}

console.error(`Photo-True V5 strict acceptance failed after ${maxAttempts} attempts.`, lastResult);
process.exit(lastResult.code || 1);
