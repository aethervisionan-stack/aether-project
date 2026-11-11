/**
 * AudioReactiveAIOrbit — central Aether Vision AI presence in the HUD.
 * Dense translucent neon wireframe sphere (Three.js) driven by WS / VAD / playback
 * spectrum from AdvancedAudioVisualizer. Never touches the PCM uplink path.
 *
 * Tech-HUD look: Fresnel rim on mesh nodes/lines, cyan↔violet energy gradient,
 * star-dust particles, soft core glow, slow data rings, soft CA + vignette post.
 * Soft opacity / heavily damped lerps preserved for daily-use FPS.
 * Spectrum is sampled only from the rAF driver callback each frame.
 */

import * as THREE from "three";
import type { VisualizerMode } from "../audio/AdvancedAudioVisualizer";

export type OrbitPresence = "point" | "full";

export interface OrbitDriveState {
  /** Conversation bridge open (ws_state === OPEN). */
  wsOpen: boolean;
  /** VAD phase is speech (or hangover). */
  vadSpeech: boolean;
  /** AI playback queue / assistant speaking. */
  playbackActive: boolean;
  mode: VisualizerMode | string;
  micLevel: number;
  playLevel: number;
  bass: number;
  mid: number;
  treble: number;
}

export type OrbitDriver = () => OrbitDriveState;

/** Tech HUD palette — vivid cyan ↔ violet, kept soft via opacity caps. */
const CYAN = new THREE.Color("#00f0ff");
const VIOLET = new THREE.Color("#7000ff");
const MAGENTA = new THREE.Color("#a060ff");

/**
 * Frame-rate independent damping factors (smaller = heavier damping / smoother).
 * Applied via THREE.MathUtils.lerp each rAF tick.
 */
const ORBIT_DAMP = {
  energy: 0.045,
  reactive: 0.038,
  bass: 0.055,
  mid: 0.05,
  treble: 0.048,
  presence: 0.042,
  scale: 0.05,
  spin: 0.04,
  hue: 0.06,
} as const;

/** Layer base opacities — translucent holographic wireframe. */
const LAYER_OPACITY = [
  { lineOp: 0.34, pointOp: 0.28 },
  { lineOp: 0.22, pointOp: 0.18 },
  { lineOp: 0.16, pointOp: 0.14 },
] as const;

/** Particle / ring budgets — tuned for solid daily FPS. */
const STAR_COUNT = 420;
const RING_DOTS = 96;
const RING_RADII = [1.42, 1.68] as const;

const VERT = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uReactive;
uniform float uLayer;
uniform float uHue;

varying float vGlow;
varying float vMix;
varying float vFresnel;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
        mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
        mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
    f.z
  );
}

void main() {
  vec3 pos = position;
  float n1 = noise(pos * 1.65 + vec3(uTime * 0.18, uTime * 0.14, uLayer));
  float n2 = noise(pos * 3.1 - vec3(uTime * 0.24, 0.0, uTime * 0.2));
  float wave = (n1 * 0.65 + n2 * 0.35) * 2.0 - 1.0;

  // Softened audio pulse — elegant deform, no blowout-scale displacement.
  float pulse = uReactive * (
    uBass * 0.42 + uMid * 0.24 + uTreble * 0.18 + uEnergy * 0.28
  );
  float deform = wave * (0.028 + pulse * 0.12) * (0.85 + uLayer * 0.2);
  float breathe = 1.0 + uReactive * (0.025 + uEnergy * 0.07) * sin(uTime * 1.85 + uLayer * 1.4);
  pos *= breathe;
  pos += normalize(position + 1e-5) * deform;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  // Sphere mesh: position ≈ normal — cheap Fresnel rim without extra attributes.
  vec3 nView = normalize(normalMatrix * normalize(position + 1e-5));
  vec3 vDir = normalize(-mv.xyz);
  float fres = pow(1.0 - clamp(dot(nView, vDir), 0.0, 1.0), 2.35);
  vFresnel = fres;

  vGlow = 0.28 + pulse * 0.38 + abs(wave) * 0.18 + fres * 0.35;
  vMix = clamp(0.22 + uHue * 0.55 + uBass * 0.12 + uTreble * 0.22 + uLayer * 0.1, 0.0, 1.0);

  gl_Position = projectionMatrix * mv;
  gl_PointSize = (1.35 + pulse * 1.8 + uLayer * 0.45 + fres * 0.9) *
    (180.0 / max(60.0, -gl_Position.z * 40.0 + 120.0));
}
`;

const FRAG_POINTS = /* glsl */ `
uniform vec3 uCyan;
uniform vec3 uViolet;
uniform vec3 uMagenta;
uniform float uOpacity;
varying float vGlow;
varying float vMix;
varying float vFresnel;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float soft = smoothstep(0.5, 0.12, d);
  vec3 col = mix(uCyan, uViolet, vMix);
  col = mix(col, uMagenta, clamp(vGlow - 0.55, 0.0, 1.0) * 0.35);
  // Rim lift — Fresnel edge reads as tech HUD glow without bloom blowout.
  col += mix(uCyan, uViolet, vMix) * vFresnel * 0.55;
  col = clamp(col, 0.0, 0.95);
  float alpha = soft * uOpacity * (0.34 + vGlow * 0.36 + vFresnel * 0.28);
  gl_FragColor = vec4(col, alpha);
}
`;

const FRAG_LINES = /* glsl */ `
uniform vec3 uCyan;
uniform vec3 uViolet;
uniform vec3 uMagenta;
uniform float uOpacity;
varying float vGlow;
varying float vMix;
varying float vFresnel;

void main() {
  vec3 col = mix(uCyan, uViolet, vMix * 0.85);
  col = mix(col, uMagenta, clamp(vGlow * 0.28, 0.0, 0.35));
  col += mix(uCyan, uViolet, vMix) * vFresnel * 0.7;
  col = clamp(col, 0.0, 0.92);
  float alpha = uOpacity * (0.22 + vGlow * 0.28 + vFresnel * 0.42);
  gl_FragColor = vec4(col, alpha);
}
`;

const VERT_STAR = /* glsl */ `
attribute float aSize;
attribute float aSeed;
uniform float uTime;
uniform float uEnergy;
uniform float uReactive;
uniform float uPresence;
varying float vAlpha;
varying float vMix;

void main() {
  // Positions are CPU-updated (attraction/dispersion); GPU only sizes + fade.
  vec3 pos = position;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vMix = clamp(aSeed * 0.55 + uEnergy * 0.45, 0.0, 1.0);
  vAlpha = (0.18 + aSeed * 0.35) * (0.35 + uPresence * 0.65) * (0.75 + uEnergy * 0.25);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * (1.0 + uReactive * 0.35) * (140.0 / max(50.0, -mv.z * 28.0 + 90.0));
}
`;

const FRAG_STAR = /* glsl */ `
uniform vec3 uCyan;
uniform vec3 uViolet;
uniform float uOpacity;
varying float vAlpha;
varying float vMix;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float soft = smoothstep(0.5, 0.08, d);
  vec3 col = mix(uCyan, uViolet, vMix);
  gl_FragColor = vec4(col, soft * vAlpha * uOpacity);
}
`;

const VERT_RING = /* glsl */ `
attribute float aDash;
uniform float uTime;
uniform float uSpin;
uniform float uAxis;
varying float vDash;
varying float vMix;

void main() {
  // uAxis: 0 = Y spin, 1 = X spin (opposite axes).
  float a = uTime * uSpin + aDash * 6.2831853;
  vec3 pos;
  if (uAxis < 0.5) {
    pos = vec3(cos(a), 0.0, sin(a));
  } else {
    pos = vec3(0.0, cos(a), sin(a));
  }
  pos *= length(position);
  vDash = fract(aDash * 12.0 + uTime * 0.08);
  vMix = aDash;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = mix(1.2, 2.4, step(0.82, vDash)) * (120.0 / max(40.0, -mv.z * 22.0 + 80.0));
}
`;

const FRAG_RING = /* glsl */ `
uniform vec3 uCyan;
uniform vec3 uViolet;
uniform float uOpacity;
varying float vDash;
varying float vMix;

void main() {
  // Dotted / numeric tick pattern — sparse bright marks.
  float tick = step(0.78, vDash);
  float softDot = 1.0 - smoothstep(0.35, 0.5, length(gl_PointCoord - 0.5));
  if (softDot < 0.01) discard;
  vec3 col = mix(uCyan, uViolet, vMix);
  float alpha = softDot * uOpacity * mix(0.22, 0.55, tick);
  gl_FragColor = vec4(col, alpha);
}
`;

const VERT_CORE = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
uniform float uReactive;
varying float vPulse;

void main() {
  vPulse = 0.55 + 0.45 * sin(uTime * 1.9);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float size = 18.0 + uReactive * 10.0 + uEnergy * 8.0 + vPulse * 6.0;
  gl_PointSize = size * (180.0 / max(60.0, -mv.z * 36.0 + 110.0));
}
`;

const FRAG_CORE = /* glsl */ `
uniform vec3 uCyan;
uniform vec3 uViolet;
uniform float uOpacity;
uniform float uHue;
varying float vPulse;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float soft = exp(-d * d * 10.5) * smoothstep(0.5, 0.05, d);
  vec3 col = mix(uCyan, uViolet, uHue);
  float alpha = soft * uOpacity * (0.28 + vPulse * 0.22);
  gl_FragColor = vec4(col, alpha);
}
`;

const VERT_POST = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAG_POST = /* glsl */ `
uniform sampler2D tDiffuse;
uniform float uCA;
uniform float uVignette;
uniform float uEnergy;
varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  // Soft chromatic aberration — energy-tied, capped for daily use.
  float ca = uCA * (0.55 + uEnergy * 0.45);
  vec2 dir = (uv - 0.5) * ca;
  float r = texture2D(tDiffuse, uv + dir).r;
  float g = texture2D(tDiffuse, uv).g;
  float b = texture2D(tDiffuse, uv - dir).b;
  vec3 col = vec3(r, g, b);
  float vig = smoothstep(0.95, 0.28, length(uv - 0.5) * uVignette);
  col *= vig;
  gl_FragColor = vec4(col, 1.0);
}
`;

interface LayerBundle {
  points: THREE.Points;
  lines: THREE.LineSegments;
  pointMat: THREE.ShaderMaterial;
  lineMat: THREE.ShaderMaterial;
  baseScale: number;
  basePointOp: number;
  baseLineOp: number;
}

interface RingBundle {
  points: THREE.Points;
  mat: THREE.ShaderMaterial;
  group: THREE.Group;
}

export class AudioReactiveAIOrbit {
  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private root: THREE.Group | null = null;
  private layers: LayerBundle[] = [];
  private rings: RingBundle[] = [];
  private starPoints: THREE.Points | null = null;
  private starMat: THREE.ShaderMaterial | null = null;
  private starPositions: Float32Array | null = null;
  private starBase: Float32Array | null = null;
  private glowCore: THREE.Points | null = null;
  private glowMat: THREE.ShaderMaterial | null = null;
  private pointCore: THREE.Points | null = null;
  private coreMat: THREE.PointsMaterial | null = null;
  private composerTarget: THREE.WebGLRenderTarget | null = null;
  private postScene: THREE.Scene | null = null;
  private postCamera: THREE.OrthographicCamera | null = null;
  private postMat: THREE.ShaderMaterial | null = null;
  private postQuad: THREE.Mesh | null = null;
  private raf = 0;
  private running = false;
  private driver: OrbitDriver | null = null;
  private readonly clock = new THREE.Clock();
  private readonly resizeObserver: ResizeObserver;
  private readonly _tmpColor = new THREE.Color();
  private energySmoothed = 0;
  private reactiveSmoothed = 0;
  private bassSmoothed = 0;
  private midSmoothed = 0;
  private trebleSmoothed = 0;
  /** 0 = idle point, 1 = full sphere — lerped for gradual Idle↔Playback. */
  private presenceSmoothed = 0;
  private scaleSmoothed = 1;
  private spinSmoothed = 0.1;
  /** 0 = cyan-dominant, 1 = violet-dominant — audio energy driven. */
  private hueSmoothed = 0.35;
  private lastW = 0;
  private lastH = 0;

  constructor() {
    this.resizeObserver = new ResizeObserver(() => this.resize());
  }

  mount(host: HTMLElement): void {
    this.disposeRenderer();
    this.host = host;
    host.classList.add("ai-orbit-stage");

    const canvas = document.createElement("canvas");
    canvas.className = "ai-orbit-canvas";
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);
    this.canvas = canvas;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer = renderer;

    const scene = new THREE.Scene();
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 40);
    camera.position.set(0, 0.15, 4.2);
    this.camera = camera;

    const root = new THREE.Group();
    scene.add(root);
    this.root = root;

    this.buildLayers(root);
    this.buildStarDust(root);
    this.buildDataRings(root);
    this.buildGlowCore(root);
    this.buildIdlePoint(root);
    this.buildPost(renderer);

    this.resizeObserver.observe(host);
    this.resize();
    this.applyPresence("point");
  }

  /** Begin rAF loop; `driver` polled each frame (analyser / VAD / WS — no PCM). */
  start(driver: OrbitDriver): void {
    this.driver = driver;
    if (this.running) {
      return;
    }
    this.running = true;
    this.clock.start();
    const tick = () => {
      if (!this.running) {
        return;
      }
      this.frame();
      this.raf = window.requestAnimationFrame(tick);
    };
    this.raf = window.requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    if (this.raf) {
      window.cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  dispose(): void {
    this.stop();
    this.driver = null;
    if (this.host) {
      this.resizeObserver.unobserve(this.host);
    }
    this.disposeRenderer();
    this.host = null;
  }

  private disposeRenderer(): void {
    for (const layer of this.layers) {
      layer.points.geometry.dispose();
      layer.lines.geometry.dispose();
      layer.pointMat.dispose();
      layer.lineMat.dispose();
    }
    this.layers = [];
    for (const ring of this.rings) {
      ring.points.geometry.dispose();
      ring.mat.dispose();
    }
    this.rings = [];
    if (this.starPoints) {
      this.starPoints.geometry.dispose();
      this.starMat?.dispose();
      this.starPoints = null;
      this.starMat = null;
      this.starPositions = null;
      this.starBase = null;
    }
    if (this.glowCore) {
      this.glowCore.geometry.dispose();
      this.glowMat?.dispose();
      this.glowCore = null;
      this.glowMat = null;
    }
    if (this.pointCore) {
      this.pointCore.geometry.dispose();
      this.coreMat?.dispose();
      this.pointCore = null;
      this.coreMat = null;
    }
    if (this.postQuad) {
      this.postQuad.geometry.dispose();
      this.postMat?.dispose();
      this.postQuad = null;
      this.postMat = null;
    }
    this.postScene = null;
    this.postCamera = null;
    this.composerTarget?.dispose();
    this.composerTarget = null;
    this.root = null;
    this.scene = null;
    this.camera = null;
    this.renderer?.dispose();
    this.renderer = null;
    if (this.canvas?.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
    this.canvas = null;
  }

  private sharedUniforms(layerIndex: number, opacity: number) {
    return {
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uTreble: { value: 0 },
      uReactive: { value: 0 },
      uLayer: { value: layerIndex * 0.45 },
      uHue: { value: 0.35 },
      uCyan: { value: CYAN },
      uViolet: { value: VIOLET },
      uMagenta: { value: MAGENTA },
      uOpacity: { value: opacity },
    };
  }

  private buildLayers(root: THREE.Group): void {
    const configs = [
      { detail: 5, scale: 1.0, ...LAYER_OPACITY[0] },
      { detail: 4, scale: 0.82, ...LAYER_OPACITY[1] },
      { detail: 4, scale: 1.16, ...LAYER_OPACITY[2] },
    ];

    configs.forEach((cfg, index) => {
      const geo = new THREE.IcosahedronGeometry(1, cfg.detail);
      const wire = new THREE.WireframeGeometry(geo);
      const uniforms = this.sharedUniforms(index, cfg.lineOp);

      const lineMat = new THREE.ShaderMaterial({
        uniforms: { ...uniforms, uOpacity: { value: cfg.lineOp } },
        vertexShader: VERT,
        fragmentShader: FRAG_LINES,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const pointMat = new THREE.ShaderMaterial({
        uniforms: { ...this.sharedUniforms(index, cfg.pointOp) },
        vertexShader: VERT,
        fragmentShader: FRAG_POINTS,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const lines = new THREE.LineSegments(wire, lineMat);
      const points = new THREE.Points(geo, pointMat);
      lines.scale.setScalar(cfg.scale);
      points.scale.setScalar(cfg.scale);
      root.add(lines);
      root.add(points);

      this.layers.push({
        points,
        lines,
        pointMat,
        lineMat,
        baseScale: cfg.scale,
        basePointOp: cfg.pointOp,
        baseLineOp: cfg.lineOp,
      });
    });
  }

  private buildStarDust(root: THREE.Group): void {
    const positions = new Float32Array(STAR_COUNT * 3);
    const sizes = new Float32Array(STAR_COUNT);
    const seeds = new Float32Array(STAR_COUNT);
    const base = new Float32Array(STAR_COUNT * 3);

    for (let i = 0; i < STAR_COUNT; i++) {
      const i3 = i * 3;
      // Soft shell around the sphere — avoids dense center clutter.
      const r = 1.55 + Math.random() * 1.35;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;
      base[i3] = x;
      base[i3 + 1] = y;
      base[i3 + 2] = z;
      sizes[i] = 0.9 + Math.random() * 1.8;
      seeds[i] = Math.random();
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uEnergy: { value: 0 },
        uReactive: { value: 0 },
        uPresence: { value: 0 },
        uCyan: { value: CYAN },
        uViolet: { value: VIOLET },
        uOpacity: { value: 0.55 },
      },
      vertexShader: VERT_STAR,
      fragmentShader: FRAG_STAR,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const pts = new THREE.Points(geo, mat);
    root.add(pts);
    this.starPoints = pts;
    this.starMat = mat;
    this.starPositions = positions;
    this.starBase = base;
  }

  private buildDataRings(root: THREE.Group): void {
    RING_RADII.forEach((radius, index) => {
      const positions = new Float32Array(RING_DOTS * 3);
      const dashes = new Float32Array(RING_DOTS);
      for (let i = 0; i < RING_DOTS; i++) {
        const t = i / RING_DOTS;
        const a = t * Math.PI * 2;
        // Seed ring on XY; vertex shader remaps by axis.
        positions[i * 3] = Math.cos(a) * radius;
        positions[i * 3 + 1] = Math.sin(a) * radius;
        positions[i * 3 + 2] = 0;
        dashes[i] = t;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.setAttribute("aDash", new THREE.BufferAttribute(dashes, 1));

      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uSpin: { value: index === 0 ? 0.07 : -0.055 },
          uAxis: { value: index === 0 ? 0 : 1 },
          uCyan: { value: CYAN },
          uViolet: { value: VIOLET },
          uOpacity: { value: 0.42 },
        },
        vertexShader: VERT_RING,
        fragmentShader: FRAG_RING,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const group = new THREE.Group();
      const points = new THREE.Points(geo, mat);
      group.add(points);
      // Slight tilt so opposite-axis rings read as HUD gimbals.
      group.rotation.z = index === 0 ? 0.18 : -0.22;
      group.rotation.x = index === 0 ? 0.12 : 0.55;
      root.add(group);
      this.rings.push({ points, mat, group });
    });
  }

  private buildGlowCore(root: THREE.Group): void {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0], 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uEnergy: { value: 0 },
        uReactive: { value: 0 },
        uHue: { value: 0.35 },
        uCyan: { value: CYAN },
        uViolet: { value: VIOLET },
        uOpacity: { value: 0.55 },
      },
      vertexShader: VERT_CORE,
      fragmentShader: FRAG_CORE,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(geo, mat);
    root.add(pts);
    this.glowCore = pts;
    this.glowMat = mat;
  }

  private buildIdlePoint(root: THREE.Group): void {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0], 3));
    const mat = new THREE.PointsMaterial({
      color: CYAN,
      size: 5,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    root.add(pts);
    this.pointCore = pts;
    this.coreMat = mat;
  }

  private buildPost(renderer: THREE.WebGLRenderer): void {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    const pr = renderer.getPixelRatio();
    this.composerTarget = new THREE.WebGLRenderTarget(
      Math.max(1, Math.floor(size.x * pr)),
      Math.max(1, Math.floor(size.y * pr)),
      {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
      },
    );
    this.composerTarget.texture.generateMipmaps = false;

    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postScene = new THREE.Scene();
    this.postMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.composerTarget.texture },
        uCA: { value: 0.0018 },
        uVignette: { value: 1.35 },
        uEnergy: { value: 0 },
      },
      vertexShader: VERT_POST,
      fragmentShader: FRAG_POST,
      depthTest: false,
      depthWrite: false,
    });
    this.postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat);
    this.postScene.add(this.postQuad);
  }

  private resize(): void {
    if (!this.host || !this.renderer || !this.camera || !this.canvas) {
      return;
    }
    const w = Math.max(1, this.host.clientWidth || 320);
    const h = Math.max(1, this.host.clientHeight || 280);
    if (w === this.lastW && h === this.lastH) {
      return;
    }
    this.lastW = w;
    this.lastH = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composerTarget) {
      const pr = this.renderer.getPixelRatio();
      this.composerTarget.setSize(Math.max(1, Math.floor(w * pr)), Math.max(1, Math.floor(h * pr)));
    }
  }

  private applyPresence(presence: OrbitPresence): void {
    // Layers stay mounted; opacity is lerped in frame() for gradual Idle↔Playback.
    if (this.host) {
      this.host.dataset.presence = presence;
    }
  }

  private updateStarDust(t: number, attract: number): void {
    const pos = this.starPositions;
    const base = this.starBase;
    if (!pos || !base || !this.starPoints) {
      return;
    }
    // CPU path reuses buffers; mild attraction / dispersion toward voice energy.
    const pull = 0.72 + (1 - attract) * 0.28;
    const disperse = (1 - attract) * 0.035;
    for (let i = 0; i < STAR_COUNT; i++) {
      const i3 = i * 3;
      const bx = base[i3];
      const by = base[i3 + 1];
      const bz = base[i3 + 2];
      const seed = i * 0.017;
      const wobble = Math.sin(t * 0.32 + seed) * disperse;
      pos[i3] = bx * pull + bx * wobble;
      pos[i3 + 1] = by * pull + by * wobble * 0.85;
      pos[i3 + 2] = bz * pull + bz * wobble * 1.1;
    }
    const attr = this.starPoints.geometry.getAttribute("position") as THREE.BufferAttribute;
    attr.needsUpdate = true;
  }

  private frame(): void {
    const renderer = this.renderer;
    const scene = this.scene;
    const camera = this.camera;
    const root = this.root;
    if (!renderer || !scene || !camera || !root) {
      return;
    }

    // Sample audio / VAD / WS once per rAF tick — keeps deformation in lockstep with paint.
    const drive = this.driver?.() ?? {
      wsOpen: false,
      vadSpeech: false,
      playbackActive: false,
      mode: "idle",
      micLevel: 0,
      playLevel: 0,
      bass: 0,
      mid: 0,
      treble: 0,
    };

    const reactiveWanted = drive.vadSpeech || drive.playbackActive;
    const fullWanted =
      drive.wsOpen ||
      drive.vadSpeech ||
      drive.playbackActive ||
      drive.mode === "speaking" ||
      drive.mode === "listening";
    this.applyPresence(fullWanted ? "full" : "point");

    const energy = Math.min(1, drive.micLevel * 0.55 + drive.playLevel * 0.9);

    // Heavy lerp damping — organic follow, no jumps between Idle and Playback.
    this.energySmoothed = THREE.MathUtils.lerp(this.energySmoothed, energy, ORBIT_DAMP.energy);
    this.reactiveSmoothed = THREE.MathUtils.lerp(
      this.reactiveSmoothed,
      reactiveWanted ? 1 : 0,
      ORBIT_DAMP.reactive,
    );
    this.bassSmoothed = THREE.MathUtils.lerp(this.bassSmoothed, drive.bass, ORBIT_DAMP.bass);
    this.midSmoothed = THREE.MathUtils.lerp(this.midSmoothed, drive.mid, ORBIT_DAMP.mid);
    this.trebleSmoothed = THREE.MathUtils.lerp(this.trebleSmoothed, drive.treble, ORBIT_DAMP.treble);
    this.presenceSmoothed = THREE.MathUtils.lerp(
      this.presenceSmoothed,
      fullWanted ? 1 : 0,
      ORBIT_DAMP.presence,
    );
    // Energy pushes palette toward violet; quiet speech holds cyan.
    const hueTarget = THREE.MathUtils.clamp(
      0.18 + this.energySmoothed * 0.72 + this.trebleSmoothed * 0.12,
      0,
      1,
    );
    this.hueSmoothed = THREE.MathUtils.lerp(this.hueSmoothed, hueTarget, ORBIT_DAMP.hue);

    const t = this.clock.getElapsedTime();

    const spinTarget = 0.08 + this.reactiveSmoothed * 0.18;
    this.spinSmoothed = THREE.MathUtils.lerp(this.spinSmoothed, spinTarget, ORBIT_DAMP.spin);
    root.rotation.y = t * this.spinSmoothed;
    root.rotation.x =
      Math.sin(t * 0.18) * 0.08 + this.reactiveSmoothed * Math.sin(t * 1.2) * 0.028;
    root.rotation.z = Math.cos(t * 0.14) * 0.055;

    const scaleTarget =
      1 +
      this.presenceSmoothed * 0.015 +
      this.reactiveSmoothed * (0.035 + this.energySmoothed * 0.08) * Math.sin(t * 2.2);
    this.scaleSmoothed = THREE.MathUtils.lerp(this.scaleSmoothed, scaleTarget, ORBIT_DAMP.scale);
    root.scale.setScalar(this.scaleSmoothed);

    const sphereFade = this.presenceSmoothed;
    const pointFade = 1 - this.presenceSmoothed;

    for (const layer of this.layers) {
      layer.points.visible = sphereFade > 0.01;
      layer.lines.visible = sphereFade > 0.01;
      for (const mat of [layer.pointMat, layer.lineMat]) {
        mat.uniforms.uTime.value = t;
        mat.uniforms.uEnergy.value = this.energySmoothed;
        mat.uniforms.uBass.value = this.bassSmoothed;
        mat.uniforms.uMid.value = this.midSmoothed;
        mat.uniforms.uTreble.value = this.trebleSmoothed;
        mat.uniforms.uReactive.value = this.reactiveSmoothed;
        mat.uniforms.uHue.value = this.hueSmoothed;
      }
      layer.pointMat.uniforms.uOpacity.value = layer.basePointOp * sphereFade;
      layer.lineMat.uniforms.uOpacity.value = layer.baseLineOp * sphereFade;
    }

    if (this.starMat) {
      this.starMat.uniforms.uTime.value = t;
      this.starMat.uniforms.uEnergy.value = this.energySmoothed;
      this.starMat.uniforms.uReactive.value = this.reactiveSmoothed;
      this.starMat.uniforms.uPresence.value = this.presenceSmoothed;
      this.starMat.uniforms.uOpacity.value = 0.28 + this.presenceSmoothed * 0.4;
      this.starPoints!.visible = this.presenceSmoothed > 0.02;
    }
    this.updateStarDust(t, this.reactiveSmoothed * (0.45 + this.energySmoothed * 0.55));

    for (const ring of this.rings) {
      ring.mat.uniforms.uTime.value = t;
      ring.mat.uniforms.uOpacity.value = (0.22 + this.presenceSmoothed * 0.28) *
        (0.75 + this.energySmoothed * 0.25);
      ring.points.visible = this.presenceSmoothed > 0.02;
      // Extra slow gimbal tumble on opposite axes.
      ring.group.rotation.y += ring.mat.uniforms.uAxis.value < 0.5 ? 0.0012 : -0.0009;
    }

    if (this.glowMat && this.glowCore) {
      this.glowMat.uniforms.uTime.value = t;
      this.glowMat.uniforms.uEnergy.value = this.energySmoothed;
      this.glowMat.uniforms.uReactive.value = this.reactiveSmoothed;
      this.glowMat.uniforms.uHue.value = this.hueSmoothed;
      // Soft pulse always present; stronger when sphere is up.
      this.glowMat.uniforms.uOpacity.value =
        (0.18 + this.presenceSmoothed * 0.42 + this.energySmoothed * 0.18) *
        (0.85 + 0.15 * Math.sin(t * 1.9));
      this.glowCore.visible = true;
    }

    if (this.pointCore && this.coreMat) {
      this.pointCore.visible = pointFade > 0.01;
      this.coreMat.opacity = (0.32 + 0.28 * (0.5 + 0.5 * Math.sin(t * 1.8))) * pointFade;
      this.coreMat.size = 4.5 + Math.sin(t * 1.8) * 1.1;
      this._tmpColor.copy(CYAN).lerp(VIOLET, this.hueSmoothed);
      this.coreMat.color.copy(this._tmpColor);
    }

    // Soft CA + vignette post — single RT pass, no EffectComposer overhead.
    if (this.composerTarget && this.postScene && this.postCamera && this.postMat) {
      this.postMat.uniforms.uEnergy.value = this.energySmoothed;
      this.postMat.uniforms.uCA.value = 0.0014 + this.reactiveSmoothed * 0.0012;
      renderer.setRenderTarget(this.composerTarget);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(this.postScene, this.postCamera);
    } else {
      renderer.render(scene, camera);
    }
  }
}
