// "Wir sind 16.000" — the BVG crowd pattern at night.
// A flashlight reveals the daytime colours; the silhouette under the pointer is
// flood-filled from the source pixels and outlined in neon with a fictional ID tag.

const IMG_SRC = "/crowd.webp";
const NIGHT_DARK = [8, 8, 16];
const NIGHT_LIGHT = [34, 30, 58];
const EDGE_RGB = [25, 230, 255];
const EDGE_ALPHA = 70;
const SCAN_RGB = "240, 215, 34";
const COLOR_TOLERANCE = 46;
const MAX_REGION_PX = 70000;
const MIN_REGION_PX = 250;
const LIGHT_RADIUS = 150;
const LIGHT_RADIUS_TOUCH = 110;
const SWEEP_EVERY_MS = 6500;
const SWEEP_MS = 1400;
const AUTO_SCAN_MS = 2600;
const TOTAL_COLLEAGUES = 16000;
const TAG_GAP = 12;

const PEOPLE = [
  ["Ayşe", "Zugfahrerin", "U5", 2017],
  ["Jonas", "Elektroniker", "U2", 2021],
  ["Marta", "Busfahrerin", "M29", 2014],
  ["Kwame", "Cloud Engineer", "U6", 2022],
  ["Lena", "Azubi Mechatronik", "U7", 2025],
  ["Dmitri", "Gleisbauer", "U8", 2012],
  ["Sophie", "Tramfahrerin", "M10", 2019],
  ["Ahmet", "Werkstattleiter", "U3", 2009],
  ["Linh", "UX Designerin", "U9", 2023],
  ["Paula", "Leitstelle", "U1", 2016],
  ["Mehmet", "Busfahrer", "100", 2018],
  ["Ines", "Duales Studium", "U4", 2024],
  ["Tomasz", "Signaltechniker", "U2", 2011],
  ["Fatima", "Kundenberaterin", "U6", 2020],
];

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// night version: luminance → deep violet ramp, plus faint cyan edges where colours change
function buildNight(src, w, h) {
  const out = new ImageData(w, h);
  const s = src.data;
  const d = out.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const lum = (s[i] * 0.3 + s[i + 1] * 0.59 + s[i + 2] * 0.11) / 255;
      const j = x < w - 1 ? i + 4 : i;
      const k = y < h - 1 ? i + w * 4 : i;
      const diff = Math.abs(s[i] - s[j]) + Math.abs(s[i + 1] - s[j + 1]) + Math.abs(s[i] - s[k]) + Math.abs(s[i + 2] - s[k + 2]);
      const edge = diff > 90;
      for (let c = 0; c < 3; c++) {
        const base = NIGHT_DARK[c] + (NIGHT_LIGHT[c] - NIGHT_DARK[c]) * lum;
        d[i + c] = edge ? base + (EDGE_RGB[c] - base) * (EDGE_ALPHA / 255) : base;
      }
      d[i + 3] = 255;
    }
  }
  return out;
}

// scanline flood fill over similar colours; returns region pixels + outline, or null if too big/small
function floodRegion(data, w, h, sx, sy) {
  const px = data.data;
  const start = (sy * w + sx) * 4;
  const r0 = px[start], g0 = px[start + 1], b0 = px[start + 2];
  const seen = new Uint8Array(w * h);
  const stack = [sy * w + sx];
  const region = [];
  const match = (p) => {
    const i = p * 4;
    return Math.abs(px[i] - r0) + Math.abs(px[i + 1] - g0) + Math.abs(px[i + 2] - b0) < COLOR_TOLERANCE;
  };
  seen[stack[0]] = 1;
  while (stack.length) {
    const p = stack.pop();
    region.push(p);
    if (region.length > MAX_REGION_PX) return null;
    const x = p % w;
    const y = (p / w) | 0;
    const n = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
    for (const q of n) {
      if (q < 0 || seen[q]) continue;
      seen[q] = 1;
      if (match(q)) stack.push(q);
    }
  }
  if (region.length < MIN_REGION_PX) return null;

  const inRegion = new Uint8Array(w * h);
  let minX = w, minY = h, maxX = 0, maxY = 0, id = Infinity;
  for (const p of region) {
    inRegion[p] = 1;
    const x = p % w, y = (p / w) | 0;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (p < id) id = p;
  }
  return { inRegion, region, box: { minX, minY, maxX, maxY }, id, rgb: [r0, g0, b0] };
}

// paint the region into its own small canvas: soft fill + bright outline
function paintRegion(found, w) {
  const { box, region, inRegion } = found;
  const bw = box.maxX - box.minX + 1;
  const bh = box.maxY - box.minY + 1;
  const c = document.createElement("canvas");
  c.width = bw;
  c.height = bh;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(bw, bh);
  const d = img.data;
  for (const p of region) {
    const x = p % w, y = (p / w) | 0;
    const edge = !inRegion[p - 1] || !inRegion[p + 1] || !inRegion[p - w] || !inRegion[p + w];
    const i = ((y - box.minY) * bw + (x - box.minX)) * 4;
    d[i] = 240; d[i + 1] = 215; d[i + 2] = 34;
    d[i + 3] = edge ? 255 : 46;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export async function initCrowd({ reducedMotion }) {
  const stage = document.querySelector("[data-crowd]");
  if (!stage) return;
  const canvas = stage.querySelector("canvas");
  const tag = stage.querySelector("[data-crowd-tag]");
  const counter = document.querySelector("[data-crowd-count]");
  const ctx = canvas.getContext("2d");

  const img = await loadImage(IMG_SRC);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const day = document.createElement("canvas");
  day.width = W;
  day.height = H;
  const dayCtx = day.getContext("2d", { willReadFrequently: true });
  dayCtx.drawImage(img, 0, 0);
  const source = dayCtx.getImageData(0, 0, W, H);
  const night = document.createElement("canvas");
  night.width = W;
  night.height = H;
  night.getContext("2d").putImageData(buildNight(source, W, H), 0, 0);

  const light = document.createElement("canvas");
  const lightCtx = light.getContext("2d");

  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const radius = finePointer ? LIGHT_RADIUS : LIGHT_RADIUS_TOUCH;
  const view = { scale: 1, ox: 0, oy: 0, cssW: 0, cssH: 0, dpr: 1 };
  const pointer = { x: 0, y: 0, active: false };
  const lamp = { x: 0, y: 0 };
  let current = null;
  let currentPaint = null;
  let flash = 0;
  const scanned = new Set();
  let running = false;
  let lastAutoScan = 0;
  let sweepStart = performance.now() + 1500;

  function resize() {
    const r = stage.getBoundingClientRect();
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.cssW = r.width;
    view.cssH = r.height;
    canvas.width = Math.round(r.width * view.dpr);
    canvas.height = Math.round(r.height * view.dpr);
    light.width = canvas.width;
    light.height = canvas.height;
    // cover-fit the pattern into the stage
    view.scale = Math.max(r.width / W, r.height / H);
    view.ox = (r.width - W * view.scale) / 2;
    view.oy = (r.height - H * view.scale) / 2;
    if (!pointer.active) { lamp.x = r.width / 2; lamp.y = r.height / 2; }
    if (!running) draw(performance.now());
  }

  const toSource = (x, y) => [Math.floor((x - view.ox) / view.scale), Math.floor((y - view.oy) / view.scale)];

  function scanAt(x, y) {
    const [sx, sy] = toSource(x, y);
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) return;
    if (current && current.inRegion[sy * W + sx]) return;
    const found = floodRegion(source, W, H, sx, sy);
    if (!found) return;
    current = found;
    currentPaint = paintRegion(found, W);
    flash = 1;
    scanned.add(found.id);
    counter.textContent = String(scanned.size).padStart(2, "0");
    showTag(found);
  }

  function showTag(found) {
    const [name, role, line, since] = PEOPLE[found.id % PEOPLE.length];
    tag.querySelector("[data-tag-name]").textContent = name;
    tag.querySelector("[data-tag-role]").textContent = role;
    tag.querySelector("[data-tag-meta]").textContent = `Linie ${line} · seit ${since}`;
    const { box } = found;
    const tagW = tag.offsetWidth;
    const right = view.ox + (box.maxX + 1) * view.scale + TAG_GAP;
    const flipped = view.ox + box.minX * view.scale - TAG_GAP - tagW;
    const left = right + tagW <= view.cssW - TAG_GAP ? right : flipped;
    const x = Math.max(TAG_GAP, Math.min(left, view.cssW - tagW - TAG_GAP));
    const y = Math.max(TAG_GAP, Math.min(view.oy + box.minY * view.scale, view.cssH - tag.offsetHeight - TAG_GAP));
    tag.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    tag.classList.remove("is-on");
    void tag.offsetWidth; // restart the entrance transition
    tag.classList.add("is-on");
  }

  function draw(now) {
    const { dpr, scale, ox, oy, cssW, cssH } = view;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(night, ox, oy, W * scale, H * scale);

    // flashlight: day colours inside a soft circle
    lightCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lightCtx.globalCompositeOperation = "source-over";
    lightCtx.clearRect(0, 0, cssW, cssH);
    lightCtx.drawImage(day, ox, oy, W * scale, H * scale);
    lightCtx.globalCompositeOperation = "destination-in";
    const g = lightCtx.createRadialGradient(lamp.x, lamp.y, 0, lamp.x, lamp.y, radius);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(0.6, "rgba(0,0,0,0.9)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    lightCtx.fillStyle = g;
    lightCtx.fillRect(0, 0, cssW, cssH);

    // periodic scan sweep: a thin band of daylight travelling down
    const sp = (now - sweepStart) / SWEEP_MS;
    if (!reducedMotion && sp > 0 && sp < 1) {
      const y = sp * cssH;
      lightCtx.globalCompositeOperation = "destination-over";
      lightCtx.save();
      lightCtx.beginPath();
      lightCtx.rect(0, y - 18, cssW, 18);
      lightCtx.clip();
      lightCtx.globalAlpha = 0.55;
      lightCtx.drawImage(day, ox, oy, W * scale, H * scale);
      lightCtx.restore();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(light, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!reducedMotion && sp > 0 && sp < 1) {
      ctx.fillStyle = `rgba(${SCAN_RGB}, 0.9)`;
      ctx.shadowColor = `rgba(${SCAN_RGB}, 1)`;
      ctx.shadowBlur = 16;
      ctx.fillRect(0, sp * cssH, cssW, 2);
      ctx.shadowBlur = 0;
    }
    if (sp >= 1) sweepStart = now + SWEEP_EVERY_MS;

    // scanned silhouette
    if (currentPaint) {
      const { box } = current;
      ctx.save();
      ctx.shadowColor = `rgba(${SCAN_RGB}, 1)`;
      ctx.shadowBlur = 12 + flash * 24;
      ctx.globalAlpha = 0.85 + flash * 0.15;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(currentPaint, ox + box.minX * scale, oy + box.minY * scale, currentPaint.width * scale, currentPaint.height * scale);
      ctx.restore();
    }
  }

  function loop(now) {
    if (!running) return;
    // lamp eases toward the pointer, or wanders on its own when idle
    let tx, ty;
    if (pointer.active) {
      tx = pointer.x; ty = pointer.y;
    } else {
      const t = now / 1000;
      tx = view.cssW * (0.5 + 0.36 * Math.sin(t * 0.37));
      ty = view.cssH * (0.5 + 0.3 * Math.sin(t * 0.61 + 1));
      if (now - lastAutoScan > AUTO_SCAN_MS) {
        lastAutoScan = now;
        scanAt(lamp.x, lamp.y);
      }
    }
    lamp.x += (tx - lamp.x) * 0.14;
    lamp.y += (ty - lamp.y) * 0.14;
    flash = Math.max(0, flash - 0.06);
    draw(now);
    requestAnimationFrame(loop);
  }

  const local = (e) => {
    const r = stage.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  if (finePointer) {
    stage.addEventListener("pointermove", (e) => {
      [pointer.x, pointer.y] = local(e);
      pointer.active = true;
      scanAt(pointer.x, pointer.y);
    });
    stage.addEventListener("pointerleave", () => { pointer.active = false; });
  }
  stage.addEventListener("pointerdown", (e) => {
    const [x, y] = local(e);
    current = null;
    scanAt(x, y);
    if (!finePointer) { lamp.x = x; lamp.y = y; lastAutoScan = performance.now() + AUTO_SCAN_MS; }
    if (reducedMotion) draw(performance.now());
  });

  window.addEventListener("resize", resize);
  resize();
  document.querySelector("[data-crowd-total]").textContent = TOTAL_COLLEAGUES.toLocaleString("de-DE");

  if (reducedMotion) {
    scanAt(lamp.x, lamp.y);
    draw(performance.now());
    return;
  }
  new IntersectionObserver(([e]) => {
    const was = running;
    running = e.isIntersecting;
    if (running && !was) requestAnimationFrame(loop);
  }).observe(stage);
}
