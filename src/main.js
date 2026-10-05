import { createScene } from "./scene.js";
import { createBoard } from "./board.js";
import { initSections } from "./sections.js";
import { initCrowd } from "./crowd.js";
import { runPreloader } from "./preloader.js";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const GLITCH_MIN_MS = 5000;
const GLITCH_JITTER_MS = 4000;
const GLITCH_CSS_MS = 200;
const SCROLL_BOOST = 0.12;

// ---------- WebGL tunnel ----------
let scene = null;
try {
  scene = createScene(document.querySelector(".scene"), { reducedMotion });
} catch {
  document.documentElement.classList.add("no-webgl");
}

// ---------- pointer + scroll drive the train ----------
if (scene && !reducedMotion) {
  window.addEventListener("pointermove", (e) => {
    scene.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
  }, { passive: true });

  let lastY = window.scrollY;
  window.addEventListener("scroll", () => {
    scene.addBoost(Math.abs(window.scrollY - lastY) * SCROLL_BOOST);
    lastY = window.scrollY;
  }, { passive: true });
}

// ---------- HUD ----------
const speedEl = document.querySelector("[data-speed]");
const speedBar = document.querySelector("[data-speed-bar]");
const clockEl = document.querySelector("[data-clock]");
const timeFmt = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", second: "2-digit" });

function updateClock() { clockEl.textContent = timeFmt.format(new Date()); }
updateClock();
setInterval(updateClock, 1000);

if (scene) {
  const tickHud = () => {
    speedEl.textContent = Math.round(scene.speed * 3.6);
    speedBar.style.transform = `scaleX(${Math.max(scene.speed / scene.maxSpeed, 0.02)})`;
    requestAnimationFrame(tickHud);
  };
  tickHud();
}

// ---------- nav background once we leave the hero ----------
const nav = document.querySelector(".nav");
const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 40);
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

// ---------- glitch: rare, short, synced between title and shader ----------
const title = document.querySelector("[data-glitch]");
function scheduleGlitch() {
  setTimeout(() => {
    if (!document.hidden && window.scrollY < window.innerHeight) {
      title.classList.add("is-glitching");
      scene?.glitch();
      setTimeout(() => title.classList.remove("is-glitching"), GLITCH_CSS_MS);
    }
    scheduleGlitch();
  }, GLITCH_MIN_MS + Math.random() * GLITCH_JITTER_MS);
}
if (!reducedMotion) scheduleGlitch();

// ---------- departure board ----------
const board = createBoard(document.querySelector("[data-rows]"), document.querySelector("[data-count]"), { reducedMotion });
const chips = [...document.querySelectorAll("[data-filter]")];

function setFilter(filter) {
  chips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.filter === filter)));
  if (filter !== board.filter || !boardShown) board.render(filter);
  boardShown = true;
}

chips.forEach((chip) => chip.addEventListener("click", () => setFilter(chip.dataset.filter)));
document.querySelectorAll("[data-filter-link]").forEach((link) =>
  link.addEventListener("click", () => setFilter(link.dataset.filterLink)),
);

// first render when the board comes into view, so the flaps are actually seen
let boardShown = false;
new IntersectionObserver((entries, obs) => {
  if (entries[0].isIntersecting) {
    if (!boardShown) setFilter("Alle");
    obs.disconnect();
  }
}, { threshold: 0.2 }).observe(document.querySelector(".board"));

// ---------- Bereiche, Ausbildung route, Benefits, Finale ----------
initSections({ scene, reducedMotion });
const crowdReady = initCrowd({ reducedMotion });

// ---------- preloader: doors open once fonts, crowd image and first WebGL frame are ready ----------
const firstFrame = new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
runPreloader({ tasks: [document.fonts.ready, crowdReady, firstFrame], scene, reducedMotion });
