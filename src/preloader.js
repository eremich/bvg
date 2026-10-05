const MIN_MS_FIRST = 1500;
const MIN_MS_REPEAT = 500;
const MAX_WAIT_MS = 6000;
const READY_BLINK_MS = 1000;
const DOOR_OPEN_MS = 1100;
const SEEN_KEY = "bvg-loader-seen";

const nextFrames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function seenBefore() {
  try {
    const seen = sessionStorage.getItem(SEEN_KEY) === "1";
    sessionStorage.setItem(SEEN_KEY, "1");
    return seen;
  } catch {
    return false;
  }
}

// track real loading, but never show progress faster than the minimum duration
function trackProgress(tasks, minMs, onTick) {
  let done = 0;
  tasks.forEach((t) => Promise.resolve(t).catch(() => {}).finally(() => { done++; }));
  const started = performance.now();
  return new Promise((resolve) => {
    function tick(now) {
      const elapsed = now - started;
      const real = tasks.length ? done / tasks.length : 1;
      const progress = elapsed > MAX_WAIT_MS ? 1 : Math.min(real, elapsed / minMs);
      onTick(progress);
      if (progress >= 1) resolve();
      else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

export async function runPreloader({ tasks, scene, reducedMotion }) {
  const root = document.querySelector("[data-loader]");
  const html = document.documentElement;
  if (!root) { html.classList.remove("is-loading"); return; }

  const lights = [...root.querySelectorAll("[data-loader-lights] li")];
  const minMs = seenBefore() ? MIN_MS_REPEAT : MIN_MS_FIRST;

  await trackProgress(tasks, minMs, (p) => {
    const lit = Math.round(p * lights.length);
    lights.forEach((l, i) => l.classList.toggle("is-on", i < lit));
  });

  root.classList.add("is-ready");
  await wait(reducedMotion ? 0 : READY_BLINK_MS);

  root.classList.add("is-open");
  html.classList.remove("is-loading");
  await nextFrames();
  scene?.kick();
  await wait(reducedMotion ? 250 : DOOR_OPEN_MS);
  root.remove();
}
