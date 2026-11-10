/**
 * AudioReactiveAIOrbit — central Aether Vision AI presence in the HUD.
 * Dense translucent neon wireframe sphere (Three.js) driven by WS / VAD / playback
 * spectrum from live AnalyserNode taps. Never touches the PCM uplink path.
 *
 * Physics:
 *  - Idle (nobody speaking): slow axis rotation ONLY — no vertex deformation.
 *  - User speaking (VAD): brighter nodes + subtle faster pulse.
 *  - Assistant speaking (playback_active): gentle mid/bass breath + clamped undulation.
 */

import * as THREE from "three";
import type { VisualizerMode } from "../audio/AdvancedAudioVisualizer";

export type OrbitPresence = "point" | "full";

/** Speak mode for shader: 0 idle, 1 user/VAD, 2 assistant/playback. */
export type OrbitSpeakMode = 0 | 1 | 2;

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

/** Tunable speak physics — kept elegant; loud PCM cannot explode past clamps. */
export const ORBIT_TUNING = {
  /** rAF lerp alphas (THREE.MathUtils.lerp). */
  lerpEnergy: 0.065,
  lerpSpeakMode: 0.07,
  lerpBright: 0.055,
  lerpBands: 0.08,
  lerpScale: 0.09,
  lerpSpin: 0.06,
  /** Hard caps so loud playback never blows out the mesh. */
  maxEnergy: 0.62,
  maxDeform: 0.085,
  maxBreath: 0.045,
  maxScaleDelta: 0.055,
  maxSpinAssist: 0.16,
  idleSpin: 0.09,
  userSpin: 0.14,
  /** Mid/bass breath frequencies (rad/s-ish via sin(t * f)). */
  breathBassHz: 1.35,
  breathMidHz: 2.1,
} as const;

const CYAN = new THREE.Color("#00F3FF");
const MAGENTA = new THREE.Color("#FF2BD6");
const PURPLE = new THREE.Color("#7000FF");

const VERT = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uSpeakMode; // 0 idle, 1 user, 2 assistant
uniform float uBright;
uniform float uLayer;
uniform float uBreath;   // pre-lerped root breath from JS (−maxBreath..+maxBreath)
uniform float uDeform;   // pre-clamped deform intensity 0..maxDeform

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
  float mode = uSpeakMode;

  float assist = smoothstep(1.2, 1.8, mode);
  float user = smoothstep(0.2, 0.8, mode) * (1.0 - assist);

  // Slow coherent noise — assistant only; never races with loud energy.
  float nSpeed = mix(0.12, 0.22 + uEnergy * 0.12, assist);
  float n1 = noise(pos * 1.55 + vec3(uTime * nSpeed, uTime * (nSpeed * 0.75), uLayer));
  float n2 = noise(pos * 2.7 - vec3(uTime * (nSpeed * 1.1), 0.0, uTime * nSpeed));
  float wave = (n1 * 0.7 + n2 * 0.3) * 2.0 - 1.0;

  // Vertex offset clamped by uDeform (JS hard-caps amplitude).
  float deform = wave * uDeform * (0.85 + uLayer * 0.2);
  float userPulse = user * (0.012 + uEnergy * 0.02) * sin(uTime * 2.2 + uLayer);

  pos *= 1.0 + uBreath + userPulse;
  pos += normalize(position + 1e-5) * deform;

  float band = clamp(uBass * 0.5 + uMid * 0.35 + uEnergy * 0.25, 0.0, 0.85);
  vGlow = 0.28 + uBright * 0.45 + assist * abs(wave) * 0.18 + user * uEnergy * 0.2;
  vMix = clamp(0.3 + uBass * 0.2 + uMid * 0.2 + uLayer * 0.12 + user * 0.12, 0.0, 1.0);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  float pt = 1.45 + uBright * 1.6 + assist * band * 1.2 + uLayer * 0.4;
  gl_PointSize = pt * (180.0 / max(60.0, -gl_Position.z * 40.0 + 120.0));
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
  col = mix(col, uMagenta, clamp(vGlow - 0.45, 0.0, 1.0) * 0.9);
  float alpha = soft * uOpacity * (0.4 + vGlow * 0.65);
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
  col = mix(col, uMagenta, clamp(vGlow * 0.55, 0.0, 0.7));
  float alpha = uOpacity * (0.28 + vGlow * 0.5);
  gl_FragColor = vec4(col, alpha);
}
`;

interface LayerBundle {
  points: THREE.Points;
  lines: THREE.LineSegments;
  pointMat: THREE.ShaderMaterial;
  lineMat: THREE.ShaderMaterial;
  baseScale: number;
  baseLineOp: number;
  basePointOp: number;
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
  private speakModeSmoothed = 0;
  private brightSmoothed = 0.35;
  private bassS = 0;
  private midS = 0;
  private trebleS = 0;
  private scaleSmoothed = 1;
  private spinSmoothed: number = ORBIT_TUNING.idleSpin;
  private breathSmoothed = 0;
  private deformSmoothed = 0;

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
        uSpeakMode: { value: 0 },
        uBright: { value: 0.35 },
        uBreath: { value: 0 },
        uDeform: { value: 0 },
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
        baseLineOp: cfg.lineOp,
        basePointOp: cfg.pointOp,
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
      this.host.dataset.speak =
        this.speakModeSmoothed > 1.4 ? "assistant" : this.speakModeSmoothed > 0.4 ? "user" : "idle";
    }
  }

  private resolveSpeakMode(drive: OrbitDriveState): OrbitSpeakMode {
    // Assistant undulation wins while playback is active; else user pulse on VAD.
    if (drive.playbackActive) {
      return 2;
    }
    if (drive.vadSpeech) {
      return 1;
    }
    return 0;
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

    const T = ORBIT_TUNING;
    const speakMode = this.resolveSpeakMode(drive);
    const full =
      drive.wsOpen ||
      drive.vadSpeech ||
      drive.playbackActive ||
      drive.mode === "speaking" ||
      drive.mode === "listening";

    // Soft energy from mid/bass rhythm (assistant) — hard-capped.
    const energyRaw =
      speakMode === 2
        ? drive.bass * 0.55 + drive.mid * 0.4 + drive.playLevel * 0.25
        : speakMode === 1
          ? Math.max(drive.micLevel * 0.9, 0.22)
          : 0;
    const energyTarget = THREE.MathUtils.clamp(energyRaw, 0, T.maxEnergy);

    const brightTarget =
      speakMode === 2
        ? 0.42 + energyTarget * 0.28
        : speakMode === 1
          ? 0.58 + energyTarget * 0.22
          : 0.32;

    this.energySmoothed = THREE.MathUtils.lerp(this.energySmoothed, energyTarget, T.lerpEnergy);
    this.speakModeSmoothed = THREE.MathUtils.lerp(this.speakModeSmoothed, speakMode, T.lerpSpeakMode);
    this.brightSmoothed = THREE.MathUtils.lerp(this.brightSmoothed, brightTarget, T.lerpBright);
    this.bassS = THREE.MathUtils.lerp(this.bassS, THREE.MathUtils.clamp(drive.bass, 0, 0.85), T.lerpBands);
    this.midS = THREE.MathUtils.lerp(this.midS, THREE.MathUtils.clamp(drive.mid, 0, 0.85), T.lerpBands);
    this.trebleS = THREE.MathUtils.lerp(
      this.trebleS,
      THREE.MathUtils.clamp(drive.treble, 0, 0.75),
      T.lerpBands,
    );

    this.applyPresence(full ? "full" : "point");

    const t = this.clock.getElapsedTime();
    const assistBlend = THREE.MathUtils.smoothstep(this.speakModeSmoothed, 1.2, 1.8);
    const userBlend = THREE.MathUtils.smoothstep(this.speakModeSmoothed, 0.2, 0.8) * (1 - assistBlend);

    // Coherent mid/bass breath — sinusoidal, voice-like, never chaotic.
    const breathWave =
      Math.sin(t * T.breathBassHz) * this.bassS * 0.55 + Math.sin(t * T.breathMidHz + 0.7) * this.midS * 0.45;
    const breathTarget = THREE.MathUtils.clamp(
      assistBlend * breathWave * (0.028 + this.energySmoothed * 0.04) +
        userBlend * Math.sin(t * 2.0) * (0.01 + this.energySmoothed * 0.015),
      -T.maxBreath,
      T.maxBreath,
    );
    this.breathSmoothed = THREE.MathUtils.lerp(this.breathSmoothed, breathTarget, T.lerpScale);

    const deformTarget = THREE.MathUtils.clamp(
      assistBlend * (0.02 + this.energySmoothed * 0.07 + this.bassS * 0.025),
      0,
      T.maxDeform,
    );
    this.deformSmoothed = THREE.MathUtils.lerp(this.deformSmoothed, deformTarget, T.lerpEnergy);

    // Idle: slow elegant spin. Speak: slight lift, still capped.
    const spinTarget =
      assistBlend > 0.5
        ? THREE.MathUtils.clamp(T.idleSpin + 0.03 + this.energySmoothed * 0.05, T.idleSpin, T.maxSpinAssist)
        : userBlend > 0.5
          ? T.userSpin
          : T.idleSpin;
    this.spinSmoothed = THREE.MathUtils.lerp(this.spinSmoothed, spinTarget, T.lerpSpin);

    root.rotation.y = t * this.spinSmoothed;
    root.rotation.x = Math.sin(t * 0.18) * 0.08 + assistBlend * this.breathSmoothed * 0.35;
    root.rotation.z = Math.cos(t * 0.14) * 0.055;

    const scaleTarget = THREE.MathUtils.clamp(
      1 + this.breathSmoothed + userBlend * this.energySmoothed * 0.02,
      1 - T.maxScaleDelta,
      1 + T.maxScaleDelta,
    );
    this.scaleSmoothed = THREE.MathUtils.lerp(this.scaleSmoothed, scaleTarget, T.lerpScale);
    root.scale.setScalar(this.scaleSmoothed);

    for (const layer of this.layers) {
      const brightBoost = 1 + (this.brightSmoothed - 0.35) * 0.55;
      for (const mat of [layer.pointMat, layer.lineMat]) {
        mat.uniforms.uTime.value = t;
        mat.uniforms.uEnergy.value = this.energySmoothed;
        mat.uniforms.uBass.value = this.bassS;
        mat.uniforms.uMid.value = this.midS;
        mat.uniforms.uTreble.value = this.trebleS;
        mat.uniforms.uSpeakMode.value = this.speakModeSmoothed;
        mat.uniforms.uBright.value = this.brightSmoothed;
        mat.uniforms.uBreath.value = this.breathSmoothed;
        mat.uniforms.uDeform.value = this.deformSmoothed;
      }
      layer.lineMat.uniforms.uOpacity.value = Math.min(1, layer.baseLineOp * brightBoost);
      layer.pointMat.uniforms.uOpacity.value = Math.min(1, layer.basePointOp * brightBoost);
    }

    if (this.coreMat) {
      this.coreMat.opacity = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.8));
      this.coreMat.size = 5 + Math.sin(t * 1.8) * 1.2;
    }

    renderer.render(scene, camera);
  }
}
