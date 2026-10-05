import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

// Official U-Bahn line colours U1–U9
const LINE_COLORS = ["#7dad4c", "#da421e", "#16683d", "#f0d722", "#7e5330", "#8c6dab", "#528dba", "#224f86", "#f3791d"];
const BG = new THREE.Color("#06060a");

const RING_SPACING = 2.4;
const RING_COUNT = 50;
const TUNNEL_LENGTH = RING_SPACING * RING_COUNT;
const BASE_SPEED = 9; // m/s while idle
const MAX_SPEED = 70;
const WARP_SPEED = 55;
const KICK_BOOST = 45;
const WARP_BLOOM = 0.9;
const CAMERA_HEIGHT = 1.5;
const BLOOM_STRENGTH = 1.15;

// tunnel cross-section: flat floor, straight walls, arched ceiling
function tunnelProfile() {
  const pts = [new THREE.Vector3(-3, 0, 0), new THREE.Vector3(3, 0, 0), new THREE.Vector3(3, 2.4, 0)];
  const ARCH_STEPS = 14;
  for (let i = 1; i < ARCH_STEPS; i++) {
    const a = (i / ARCH_STEPS) * Math.PI;
    pts.push(new THREE.Vector3(Math.cos(a) * 3, 2.4 + Math.sin(a) * 1.7, 0));
  }
  pts.push(new THREE.Vector3(-3, 2.4, 0));
  return pts;
}

const PostShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGlitch: { value: 0 },
    uSpeed: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uGlitch, uSpeed;
    uniform vec2 uResolution;
    varying vec2 vUv;
    float rand(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      float row = floor(uv.y * 28.0);
      float tick = floor(uTime * 24.0);
      float band = step(0.62, rand(vec2(row, tick)));
      uv.x += (rand(vec2(row, tick + 1.0)) - 0.5) * 0.08 * uGlitch * band;

      vec2 dir = uv - 0.5;
      float d = length(dir);
      float ab = (0.004 + 0.012 * uSpeed + 0.05 * uGlitch) * d;
      vec3 col = vec3(
        texture2D(tDiffuse, uv + dir * ab).r,
        texture2D(tDiffuse, uv).g,
        texture2D(tDiffuse, uv - dir * ab).b
      );
      col *= 0.93 + 0.07 * sin(vUv.y * uResolution.y * 1.4);
      col += (rand(vUv * uResolution + fract(uTime)) - 0.5) * 0.035;
      col *= smoothstep(1.05, 0.3, d);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

function buildRings() {
  const geo = new THREE.BufferGeometry().setFromPoints(tunnelProfile());
  const dim = new THREE.LineBasicMaterial({ color: "#6a55b8", transparent: true, opacity: 0.75 });
  const bright = new THREE.LineBasicMaterial({ color: new THREE.Color("#19e6ff").multiplyScalar(1.6), toneMapped: false });
  const group = new THREE.Group();
  for (let i = 0; i < RING_COUNT; i++) {
    const ring = new THREE.LineLoop(geo, i % 6 === 0 ? bright : dim);
    ring.position.z = -i * RING_SPACING;
    group.add(ring);
  }
  return group;
}

// lines running along the tunnel, static relative to the camera (they look identical at every z)
function buildRails() {
  const positions = [];
  const along = (x, y) => positions.push(x, y, 2, x, y, -TUNNEL_LENGTH);
  tunnelProfile().forEach((p, i) => { if (i % 3 === 0) along(p.x, p.y); });
  [-0.75, 0.75].forEach((x) => along(x, 0.05));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: "#4a3d80" }));
}

// neon tubes along both walls in U-line colours, recycled as the train moves
function buildNeon() {
  const COUNT = 64;
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.05, 0.05, 1.8),
    new THREE.MeshBasicMaterial({ toneMapped: false }),
    COUNT,
  );
  const items = [];
  const color = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    items.push({ x: side * 2.95, y: 1.2 + (i % 3) * 0.55, z: -Math.random() * TUNNEL_LENGTH });
    color.set(LINE_COLORS[i % LINE_COLORS.length]).multiplyScalar(2.2);
    mesh.setColorAt(i, color);
  }
  return { mesh, items };
}

// fast streaks close to the walls — sell the speed
function buildStreaks() {
  const COUNT = 60;
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.015, 0.015, 4),
    new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.85 }),
    COUNT,
  );
  const items = [];
  const color = new THREE.Color();
  const palette = ["#f0d722", "#ff2e88", "#19e6ff"];
  for (let i = 0; i < COUNT; i++) {
    const a = Math.random() * Math.PI * 2;
    items.push({ x: Math.cos(a) * (2.4 + Math.random() * 0.5), y: 2 + Math.sin(a) * 1.8, z: -Math.random() * TUNNEL_LENGTH, k: 1.5 + Math.random() * 1.5 });
    color.set(palette[i % 3]).multiplyScalar(1.8);
    mesh.setColorAt(i, color);
  }
  return { mesh, items };
}

function buildSleepers() {
  const COUNT = Math.ceil(TUNNEL_LENGTH / 0.8);
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(2.2, 0.04, 0.18),
    new THREE.MeshBasicMaterial({ color: "#161322" }),
    COUNT,
  );
  const items = Array.from({ length: COUNT }, (_, i) => ({ x: 0, y: 0.01, z: -i * 0.8 }));
  return { mesh, items };
}

function buildDust() {
  const COUNT = 900;
  const pos = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 5.6;
    pos[i * 3 + 1] = Math.random() * 4;
    pos[i * 3 + 2] = -Math.random() * TUNNEL_LENGTH;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: "#c9f6ff", size: 0.03, transparent: true, opacity: 0.55, depthWrite: false });
  return new THREE.Points(geo, mat);
}

// the light at the end of the tunnel
function buildPortal() {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec2 vUv; uniform float uTime;
      void main(){
        float d = length(vUv - 0.5);
        float core = smoothstep(0.5, 0.0, d);
        vec3 col = mix(vec3(1.0, 0.18, 0.53), vec3(0.94, 0.84, 0.13) * 2.4, core * core);
        gl_FragColor = vec4(col * core * (0.85 + 0.15 * sin(uTime * 2.0)), core);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(18, 14), mat);
  mesh.position.set(0, 2, -TUNNEL_LENGTH + 6);
  return mesh;
}

const wrapZ = (z) => {
  let v = z % TUNNEL_LENGTH;
  if (v > 2) v -= TUNNEL_LENGTH;
  return v;
};

export function createScene(canvas, { reducedMotion }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.setClearColor(BG);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(BG, 0.024);
  const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 200);
  camera.position.set(0, CAMERA_HEIGHT, 0);

  const rings = buildRings();
  const neon = buildNeon();
  const streaks = buildStreaks();
  const sleepers = buildSleepers();
  const dust = buildDust();
  const portal = buildPortal();
  scene.add(rings, buildRails(), neon.mesh, streaks.mesh, sleepers.mesh, dust, portal);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), BLOOM_STRENGTH, 0.55, 0.18);
  composer.addPass(bloom);
  const post = new ShaderPass(PostShader);
  composer.addPass(post);
  composer.addPass(new OutputPass());

  const state = {
    travel: 0,
    speed: reducedMotion ? 0 : BASE_SPEED,
    boost: 0,
    warp: 0,
    warpLevel: 0,
    glitch: 0,
    pointer: new THREE.Vector2(),
    look: new THREE.Vector2(),
  };

  const dummy = new THREE.Object3D();
  function placeInstances({ mesh, items }, offset, multiplier = 1) {
    items.forEach((it, i) => {
      dummy.position.set(it.x, it.y, wrapZ(it.z + offset * (it.k ?? multiplier)));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    // narrow screens: widen FOV so the tunnel still reads
    camera.fov = w < 600 ? 88 : 72;
    camera.updateProjectionMatrix();
    post.uniforms.uResolution.value.set(w, h);
  }

  const timer = new THREE.Timer();
  function frame() {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.05);
    const t = timer.getElapsed();

    if (!reducedMotion) {
      state.warpLevel += (state.warp - state.warpLevel) * (1 - Math.exp(-dt * 1.5));
      const target = Math.min(BASE_SPEED + state.boost + state.warpLevel * WARP_SPEED, MAX_SPEED);
      state.speed += (target - state.speed) * (1 - Math.exp(-dt * 2.5));
      state.boost *= Math.exp(-dt * 1.8);
      state.travel += state.speed * dt;

      // spring-ish follow of the pointer for a decorative, weighty camera
      state.look.lerp(state.pointer, 1 - Math.exp(-dt * 3));
      camera.position.x = state.look.x * 0.9 + Math.sin(t * 0.7) * 0.05;
      camera.position.y = CAMERA_HEIGHT + state.look.y * 0.35 + Math.sin(t * 9) * 0.004 * state.speed / BASE_SPEED;
      camera.rotation.set(state.look.y * 0.08, -state.look.x * 0.12, -state.look.x * 0.04);
    }

    rings.position.z = state.travel % RING_SPACING;
    placeInstances(neon, state.travel);
    placeInstances(streaks, state.travel);
    placeInstances(sleepers, state.travel);
    dust.position.z = (state.travel * 0.6) % TUNNEL_LENGTH;

    state.glitch = Math.max(0, state.glitch - dt * 5);
    post.uniforms.uTime.value = t;
    post.uniforms.uGlitch.value = state.glitch;
    post.uniforms.uSpeed.value = (state.speed - BASE_SPEED) / MAX_SPEED;
    portal.material.uniforms.uTime.value = t;
    bloom.strength = BLOOM_STRENGTH + state.warpLevel * WARP_BLOOM;
    portal.scale.setScalar(1 + state.warpLevel * 0.8);

    composer.render(dt);
  }

  resize();
  window.addEventListener("resize", resize);

  if (reducedMotion) {
    state.travel = 1.1;
    frame();
    window.addEventListener("resize", () => frame());
  } else {
    renderer.setAnimationLoop(frame);
  }

  return {
    setPointer(x, y) { state.pointer.set(x, y); },
    addBoost(v) { state.boost = Math.min(state.boost + v, MAX_SPEED); },
    glitch() { state.glitch = 1; },
    kick() { state.boost = Math.min(state.boost + KICK_BOOST, MAX_SPEED); state.glitch = 1; },
    setWarp(v) { state.warp = v; },
    get speed() { return state.speed; },
    maxSpeed: MAX_SPEED,
  };
}
