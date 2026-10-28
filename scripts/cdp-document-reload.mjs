// Page.reload may acknowledge before the old document is replaced. Waiting on
// readyState alone can accept that old document and evaluate into its teardown.
export async function reloadCdpDocument(send, evaluate, options = {}) {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const now = options.now ?? Date.now;
  const pause = options.pause ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const previousOrigin = await evaluate("performance.timeOrigin");
  if (!Number.isFinite(previousOrigin)) throw new Error("Missing pre-reload document identity");
  await send("Page.reload", { ignoreCache: true });
  const deadline = now() + timeoutMs;
  let lastState, lastNavigationError;
  while (now() < deadline) {
    try {
      lastState = await evaluate("({timeOrigin:performance.timeOrigin,readyState:document.readyState})");
      if (lastState?.readyState === "complete" && Number.isFinite(lastState.timeOrigin) && lastState.timeOrigin !== previousOrigin) return;
    } catch (error) {
      // Retry only document reads during this explicitly requested navigation.
      // A genuinely closed target still fails the unchanged reload deadline.
      if (!/Inspected target navigated or closed|Execution context was destroyed|Cannot find context with specified id/.test(String(error))) throw error;
      lastNavigationError = String(error);
    }
    await pause(120);
  }
  throw new Error(`New document did not complete after reload: ${JSON.stringify(lastState)}; ${lastNavigationError ?? "no navigation error"}`);
}
