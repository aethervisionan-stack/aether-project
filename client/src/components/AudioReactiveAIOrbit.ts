/**
 * AudioReactiveAIOrbit — central Aether Vision AI presence in the HUD.
 * Dense translucent neon wireframe sphere (Three.js) driven by WS / VAD / playback
 * spectrum from AdvancedAudioVisualizer. Never touches the PCM uplink path.
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

const CYAN = new THREE.Color("#00F3FF");
const MAGENTA = new THREE.Color("#FF2BD6");
const PURPLE = new THREE.Color("#7000FF");

const VERT = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uReactive;
uniform float uLayer;

varying float vGlow;
varying float vMix;

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
  float n1 = noise(pos * 1.65 + vec3(uTime * 0.22, uTime * 0.18, uLayer));
  float n2 = noise(pos * 3.1 - vec3(uTime * 0.31, 0.0, uTime * 0.27));
  float wave = (n1 * 0.65 + n2 * 0.35) * 2.0 - 1.0;

  float pulse = uReactive * (
    uBass * 0.55 + uMid * 0.28 + uTreble * 0.22 + uEnergy * 0.35
  );
  float deform = wave * (0.045 + pulse * 0.22) * (0.85 + uLayer * 0.25);
  float breathe = 1.0 + uReactive * (0.04 + uEnergy * 0.12) * sin(uTime * 2.4 + uLayer * 1.7);
  pos *= breathe;
  pos += normalize(position + 1e-5) * deform;

  vGlow = 0.35 + pulse * 0.55 + abs(wave) * 0.25;
  vMix = clamp(0.35 + uBass * 0.25 + uTreble * 0.4 + uLayer * 0.15, 0.0, 1.0);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = (1.6 + pulse * 3.2 + uLayer * 0.6) * (180.0 / max(60.0, -gl_Position.z * 40.0 + 120.0));
}
`;

const FRAG_POINTS = /* glsl */ `
uniform vec3 uCyan;
uniform vec3 uMagenta;
uniform vec3 uPurple;
uniform float uOpacity;
varying float vGlow;
varying float vMix;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float soft = smoothstep(0.5, 0.08, d);
  vec3 col = mix(uPurple, uCyan, vMix);
  col = mix(col, uMagenta, clamp(vGlow - 0.55, 0.0, 1.0) * 0.85);
  float alpha = soft * uOpacity * (0.45 + vGlow * 0.55);
  gl_FragColor = vec4(col, alpha);
}
`;

const FRAG_LINES = /* glsl */ `
uniform vec3 uCyan;
uniform vec3 uMagenta;
uniform vec3 uPurple;
uniform float uOpacity;
varying float vGlow;
varying float vMix;

void main() {
  vec3 col = mix(uCyan, uPurple, vMix * 0.7);
  col = mix(col, uMagenta, clamp(vGlow * 0.5, 0.0, 0.65));
  float alpha = uOpacity * (0.32 + vGlow * 0.45);
  gl_FragColor = vec4(col, alpha);
}
`;

interface LayerBundle {
  points: THREE.Points;
  lines: THREE.LineSegments;
  pointMat: THREE.ShaderMaterial;
  lineMat: THREE.ShaderMaterial;
  baseScale: number;
}

export class AudioReactiveAIOrbit {
  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private root: THREE.Group | null = null;
  private layers: LayerBundle[] = [];
  private pointCore: THREE.Points | null = null;
  private coreMat: THREE.PointsMaterial | null = null;
  private raf = 0;
  private running = false;
  private driver: OrbitDriver | null = null;
  private readonly clock = new THREE.Clock();
  private readonly resizeObserver: ResizeObserver;
  private energySmoothed = 0;
  private reactiveSmoothed = 0;

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
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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
    this.buildIdlePoint(root);

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
    if (this.pointCore) {
      this.pointCore.geometry.dispose();
      this.coreMat?.dispose();
      this.pointCore = null;
      this.coreMat = null;
    }
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

  private buildLayers(root: THREE.Group): void {
    const configs = [
      { detail: 5, scale: 1.0, lineOp: 0.72, pointOp: 0.62 },
      { detail: 4, scale: 0.82, lineOp: 0.48, pointOp: 0.42 },
      { detail: 4, scale: 1.16, lineOp: 0.36, pointOp: 0.34 },
    ];

    configs.forEach((cfg, index) => {
      const geo = new THREE.IcosahedronGeometry(1, cfg.detail);
      const wire = new THREE.WireframeGeometry(geo);
      const uniforms = {
        uTime: { value: 0 },
        uEnergy: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uTreble: { value: 0 },
        uReactive: { value: 0 },
        uLayer: { value: index * 0.45 },
        uCyan: { value: CYAN },
        uMagenta: { value: MAGENTA },
        uPurple: { value: PURPLE },
        uOpacity: { value: cfg.lineOp },
      };

      const lineMat = new THREE.ShaderMaterial({
        uniforms: { ...uniforms, uOpacity: { value: cfg.lineOp } },
        vertexShader: VERT,
        fragmentShader: FRAG_LINES,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const pointMat = new THREE.ShaderMaterial({
        uniforms: { ...uniforms, uOpacity: { value: cfg.pointOp } },
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
      });
    });
  }

  private buildIdlePoint(root: THREE.Group): void {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0], 3));
    const mat = new THREE.PointsMaterial({
      color: CYAN,
      size: 6,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    root.add(pts);
    this.pointCore = pts;
    this.coreMat = mat;
  }

  private resize(): void {
    if (!this.host || !this.renderer || !this.camera || !this.canvas) {
      return;
    }
    const w = Math.max(1, this.host.clientWidth || 320);
    const h = Math.max(1, this.host.clientHeight || 280);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private applyPresence(presence: OrbitPresence): void {
    const full = presence === "full";
    for (const layer of this.layers) {
      layer.points.visible = full;
      layer.lines.visible = full;
    }
    if (this.pointCore) {
      this.pointCore.visible = !full;
    }
    if (this.host) {
      this.host.dataset.presence = presence;
    }
  }

  private frame(): void {
    const renderer = this.renderer;
    const scene = this.scene;
    const camera = this.camera;
    const root = this.root;
    if (!renderer || !scene || !camera || !root) {
      return;
    }

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
    const full =
      drive.wsOpen || drive.vadSpeech || drive.playbackActive || drive.mode === "speaking" || drive.mode === "listening";
    this.applyPresence(full ? "full" : "point");

    const energy = Math.min(1, drive.micLevel * 0.55 + drive.playLevel * 0.9);
    this.energySmoothed += (energy - this.energySmoothed) * 0.12;
    this.reactiveSmoothed += ((reactiveWanted ? 1 : 0) - this.reactiveSmoothed) * 0.1;

    const t = this.clock.getElapsedTime();

    // Slow idle axis rotation; speed up slightly when reactive.
    const spin = 0.12 + this.reactiveSmoothed * 0.35;
    root.rotation.y = t * spin;
    root.rotation.x = Math.sin(t * 0.21) * 0.12 + this.reactiveSmoothed * Math.sin(t * 1.7) * 0.05;
    root.rotation.z = Math.cos(t * 0.17) * 0.08;

    const scaleBreath =
      1 +
      (full ? 0.02 : 0) +
      this.reactiveSmoothed * (0.06 + this.energySmoothed * 0.14) * Math.sin(t * 3.1);
    root.scale.setScalar(scaleBreath);

    for (const layer of this.layers) {
      for (const mat of [layer.pointMat, layer.lineMat]) {
        mat.uniforms.uTime.value = t;
        mat.uniforms.uEnergy.value = this.energySmoothed;
        mat.uniforms.uBass.value = drive.bass;
        mat.uniforms.uMid.value = drive.mid;
        mat.uniforms.uTreble.value = drive.treble;
        mat.uniforms.uReactive.value = this.reactiveSmoothed;
      }
    }

    if (this.coreMat) {
      this.coreMat.opacity = 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(t * 2.2));
      this.coreMat.size = 5 + Math.sin(t * 2.2) * 1.5;
    }

    renderer.render(scene, camera);
  }
}
