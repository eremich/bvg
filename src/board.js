// Fictional openings, styled as departures. Line colours follow the BVG network.
const JOBS = [
  { line: "U5", color: "#7e5330", type: "ubahn", title: "Zugfahrer:in U-Bahn", area: "Fahrdienst", track: "Betriebshof Friedrichsfelde", min: 0 },
  { line: "M10", color: "#be1414", type: "tram", title: "Straßenbahnfahrer:in", area: "Fahrdienst", track: "Betriebshof Marzahn", min: 3 },
  { line: "M29", color: "#95276e", type: "bus", title: "Busfahrer:in · Quereinstieg", area: "Fahrdienst", track: "Betriebshof Spandau", min: 5 },
  { line: "U2", color: "#da421e", type: "ubahn", title: "Elektroniker:in Betriebstechnik", area: "Technik", track: "Werkstatt Grunewald", min: 8 },
  { line: "U7", color: "#528dba", type: "ubahn", title: "Mechatroniker:in Schienenfahrzeuge", area: "Technik", track: "Hauptwerkstatt Britz", min: 12 },
  { line: "U6", color: "#8c6dab", type: "ubahn", title: "Cloud Engineer", area: "IT", track: "Holzmarktstraße", min: 15 },
  { line: "U9", color: "#f3791d", type: "ubahn", title: "UX Designer:in Fahrgast-Apps", area: "IT", track: "Holzmarktstraße", min: 18 },
  { line: "U4", color: "#f0d722", type: "ubahn", dark: true, title: "Ausbildung Elektroniker:in", area: "Ausbildung", track: "Ausbildungszentrum", min: 21 },
  { line: "U1", color: "#7dad4c", type: "ubahn", title: "Duales Studium Wirtschaftsinformatik", area: "Ausbildung", track: "HWR Berlin", min: 25 },
  { line: "U3", color: "#16683d", type: "ubahn", title: "Ausbildung Kfz-Mechatroniker:in", area: "Ausbildung", track: "Betriebshof Cicerostraße", min: 30 },
];

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ0123456789:·/-";
const FLAP_MS = 520;
const ROW_STAGGER_MS = 60;

const randomGlyph = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];

// split-flap: characters settle left → right while the rest keeps flipping
function flap(el, finalText, delay) {
  const start = performance.now() + delay;
  el.textContent = "";
  function tick(now) {
    const p = Math.min(Math.max((now - start) / FLAP_MS, 0), 1);
    const settled = Math.floor(p * finalText.length);
    let out = finalText.slice(0, settled);
    for (let i = settled; i < finalText.length; i++) {
      out += finalText[i] === " " ? " " : randomGlyph();
    }
    el.textContent = now < start ? "" : out;
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = finalText;
  }
  requestAnimationFrame(tick);
}

function timeLabel(min) { return min === 0 ? "jetzt" : `${min} Min`; }

function rowMarkup(job) {
  const lineClass = ["row__line", `row__line--${job.type}`, job.dark ? "row__line--dark" : ""].join(" ");
  return `
    <span class="${lineClass}">${job.line}</span>
    <span class="row__dest" data-flap></span>
    <span class="row__area" data-flap></span>
    <span class="row__track" data-flap></span>
    <span class="row__time ${job.min === 0 ? "row__time--now" : ""}" data-flap></span>
    <a class="row__apply" href="#abfahrt" aria-label="Jetzt bewerben: ${job.title}">Bewerben <span aria-hidden="true">→</span></a>`;
}

export function createBoard(root, countEl, { reducedMotion }) {
  let current = "Alle";

  function render(filter) {
    current = filter;
    const jobs = JOBS.filter((j) => filter === "Alle" || j.area === filter);
    root.innerHTML = "";
    jobs.forEach((job, i) => {
      const li = document.createElement("li");
      li.className = "row row--enter";
      li.style.setProperty("--line-color", job.color);
      li.style.animationDelay = `${i * ROW_STAGGER_MS}ms`;
      li.innerHTML = rowMarkup(job);
      const values = [job.title, job.area, job.track, timeLabel(job.min)];
      li.querySelectorAll("[data-flap]").forEach((el, k) => {
        if (reducedMotion) el.textContent = values[k];
        else flap(el, values[k], i * ROW_STAGGER_MS + k * 40);
      });
      root.appendChild(li);
    });
    countEl.textContent = jobs.length;
  }

  return {
    render,
    get filter() { return current; },
  };
}
