const TILT_MAX_DEG = 6;
const TILT_EASE = 0.12;
const REVEAL_STAGGER_STEP = 1;

// fade-up blocks as they enter; siblings in one list get a short stagger
function initReveal(reducedMotion) {
  const items = document.querySelectorAll("[data-reveal]");
  items.forEach((el) => {
    const siblings = el.parentElement.querySelectorAll(":scope > [data-reveal]");
    if (siblings.length > 1) el.style.setProperty("--i", [...siblings].indexOf(el) * REVEAL_STAGGER_STEP);
  });
  if (reducedMotion) {
    items.forEach((el) => el.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -10% 0px" });
  items.forEach((el) => io.observe(el));
}

// pointer position as CSS vars, used by the glow / holo gradients
function trackPointer(el) {
  el.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  });
}

// cards lean toward the pointer, eased so they feel weighty rather than glued
function initTilt(el) {
  const target = { x: 0, y: 0 };
  const current = { x: 0, y: 0 };
  let raf = 0;

  function step() {
    current.x += (target.x - current.x) * TILT_EASE;
    current.y += (target.y - current.y) * TILT_EASE;
    el.style.transform = `perspective(900px) rotateX(${current.y}deg) rotateY(${current.x}deg)`;
    const settled = Math.abs(target.x - current.x) < 0.01 && Math.abs(target.y - current.y) < 0.01;
    if (settled && target.x === 0 && target.y === 0) {
      el.style.transform = "";
      el.style.transition = "";
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(step);
  }

  el.addEventListener("pointerenter", () => { el.style.transition = "none"; });
  el.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect();
    target.x = ((e.clientX - r.left) / r.width - 0.5) * 2 * TILT_MAX_DEG;
    target.y = -((e.clientY - r.top) / r.height - 0.5) * 2 * TILT_MAX_DEG;
    if (!raf) raf = requestAnimationFrame(step);
  });
  el.addEventListener("pointerleave", () => {
    target.x = 0;
    target.y = 0;
    if (!raf) raf = requestAnimationFrame(step);
  });
}

// the Ausbildung line fills as you scroll; stops light up once the train passes them
function initRoute() {
  const route = document.querySelector("[data-route]");
  if (!route) return;
  const stops = [...route.querySelectorAll(".stop")];
  const last = stops.length - 1;

  function update() {
    const r = route.getBoundingClientRect();
    const vh = window.innerHeight;
    const start = vh * 0.8;
    const end = vh * 0.35;
    const p = Math.min(Math.max((start - r.top) / (start - end + r.height * 0.5), 0), 1);
    route.style.setProperty("--progress", p.toFixed(4));
    stops.forEach((s, i) => s.classList.toggle("is-passed", p >= i / last - 0.001));
  }
  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
}

// when the finale is on screen the train goes to warp speed
function initWarp(scene) {
  const finale = document.querySelector("[data-warp]");
  if (!finale || !scene) return;
  new IntersectionObserver(([e]) => scene.setWarp(e.intersectionRatio), {
    threshold: [0, 0.25, 0.5, 0.75, 1],
  }).observe(finale);
}

export function initSections({ scene, reducedMotion }) {
  initReveal(reducedMotion);
  initRoute();
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (finePointer) {
    document.querySelectorAll("[data-tilt], [data-holo]").forEach(trackPointer);
    if (!reducedMotion) document.querySelectorAll("[data-tilt]").forEach(initTilt);
  }
  if (!reducedMotion) initWarp(scene);
}
