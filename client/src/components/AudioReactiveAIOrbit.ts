/**
 * AudioReactiveAIOrbit — Unreal/CGI-grade plexus AI presence for the Aether HUD.
 * Ultra-thin LineSegments + sharp Points, UnrealBloomPass, depth neon gradient.
 * Driven by WS / VAD / playback AnalyserNode taps — never touches PCM uplink.
 *
 * Physics (stricter damping on top of 42f81af clamps):
 *  - Idle: slow elegant rotation ONLY — no vertex deformation.
 *  - User (VAD): brighter nodes + subtle pulse.
 *  - Assistant (playback): critically-damped mid/bass breath + fluid undulation.
 */

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { VisualizerMode } from "../audio/AdvancedAudioVisualizer";

export type OrbitPresence = "point" | "full";

/** Speak mode for shader: 0 idle, 1 user/VAD, 2 assistant/playback. */
export type OrbitSpeakMode = 0 | 1 | 2;

export interface OrbitDriveState {
  wsOpen: boolean;
  vadSpeech: boolean;
  playbackActive: boolean;
  mode: VisualizerMode | string;
  micLevel: number;
  playLevel: number;
  bass: number;
  mid: number;
  treble: number;
}

export type OrbitDriver = () => OrbitDriveState;

/**
 * Ultra-smooth speak physics — stricter lerps + spring damp; clamps unchanged or tighter.
 * Do not raise maxDeform / maxBreath / maxEnergy above prior caps.
 */
export const ORBIT_TUNING = {
  lerpEnergy: 0.038,
  lerpSpeakMode: 0.042,
  lerpBright: 0.035,
  lerpBands: 0.048,
  lerpScale: 0.05,
  lerpSpin: 0.04,
  /** Critically-damped spring on deform (accel + velocity damp). */
  deformSpring: 0.045,
  deformDamp: 0.86,
  breathSpring: 0.055,
  breathDamp: 0.88,
  maxEnergy: 0.58,
  maxDeform: 0.072,
  maxBreath: 0.038,
  maxScaleDelta: 0.048,
  maxSpinAssist: 0.14,
  idleSpin: 0.085,
  userSpin: 0.12,
  breathBassHz: 1.15,
  breathMidHz: 1.75,
} as const;

/**
 * CGI plexus look — HUD-harmonized palette + elegant bloom.
 * Hexes mirror `main.css` :root tokens (`--cyan`, `--purple`, `--bg0`).
 */
export const ORBIT_LOOK = {
  /** Icosahedron detail: faces = 20 * 4^detail. */
  primaryDetail: 6, // 81 920 faces
  shellDetail: 5,
  coreDetail: 5,
  primaryScale: 1.0,
  shellScale: 1.13,
  coreScale: 0.8,
  maxPixelRatio: 1.75,
  /** Soft bloom — elegant on dark HUD, not blown out. */
  bloomStrength: 0.52,
  bloomRadius: 0.42,
  bloomThreshold: 0.32,
  lineOpacityPrimary: 0.28,
  pointOpacityPrimary: 0.78,
  /** Clear / fog match `--bg0`. */
  clearHex: 0x050811,
  toneExposure: 0.92,
} as const;

/** HUD `--cyan` — crest / energy-beam accents. */
const CYAN = new THREE.Color("#00f3ff");
/** Futuristic neon blue primary (crest→limb midtones). */
const NEON_BLUE = new THREE.Color("#3aa7ff");
/** HUD `--purple` — deep folds / core violet. */
const PURPLE = new THREE.Color("#7000ff");
/** Soft violet (not hot magenta) for inner-layer depth. */
const VIOLET = new THREE.Color("#8b5cff");

const VERT = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uSpeakMode;
uniform float uBright;
uniform float uLayer;
uniform float uBreath;
uniform float uDeform;
uniform float uIsPoint; // 1 = Points, 0 = LineSegments

varying float vGlow;
varying float vMix;
varying float vFresnel;
varying float vCrest;

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

  // Low-frequency organic field — no harsh high-freq vibration.
  float nSpeed = mix(0.08, 0.14 + uEnergy * 0.06, assist);
  float n1 = noise(pos * 1.35 + vec3(uTime * nSpeed, uTime * (nSpeed * 0.7), uLayer));
  float n2 = noise(pos * 2.2 - vec3(uTime * (nSpeed * 0.9), 0.0, uTime * nSpeed * 0.85));
  float wave = (n1 * 0.72 + n2 * 0.28) * 2.0 - 1.0;

  float deform = wave * uDeform * (0.8 + uLayer * 0.18);
  float userPulse = user * (0.008 + uEnergy * 0.012) * sin(uTime * 1.7 + uLayer);

  pos *= 1.0 + uBreath + userPulse;
  pos += normalize(position + 1e-5) * deform;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vec3 viewDir = normalize(-mv.xyz);
  vec3 nView = normalize(normalMatrix * normalize(position));
  float fres = pow(1.0 - clamp(abs(dot(viewDir, nView)), 0.0, 1.0), 1.55);

  // Crest (wave+) = cyan front; fold/core (wave−, deeper layers) = magenta/purple.
  float crest = clamp(wave * 0.5 + 0.5, 0.0, 1.0);
  float fold = 1.0 - crest;
  float depth = clamp((-mv.z - 2.4) * 0.22 + uLayer * 0.35, 0.0, 1.0);
  vCrest = crest;
  vMix = clamp(crest * 0.7 + fres * 0.45 - fold * 0.35 - depth * 0.4, 0.0, 1.0);
  vFresnel = fres;
  vGlow = 0.3 + uBright * 0.38 + fres * 0.4 + crest * 0.2 + assist * crest * 0.1;

  gl_Position = projectionMatrix * mv;
  float pt = mix(0.0, 1.05 + uBright * 1.15 + fres * 1.25 + crest * 0.55, uIsPoint);
  gl_PointSize = pt * (210.0 / max(50.0, -mv.z * 36.0 + 105.0));
}
`;

const FRAG_POINTS = /* glsl */ `
uniform vec3 uCyan;
uniform vec3 uBlue;
uniform vec3 uViolet;
uniform vec3 uPurple;
uniform float uOpacity;
varying float vGlow;
varying float vMix;
varying float vFresnel;
varying float vCrest;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  // Sharp luminous core + restrained halo (HUD-elegant, not blown out).
  float core = smoothstep(0.4, 0.03, d);
  float halo = smoothstep(0.5, 0.16, d);
  vec3 crestCol = mix(uBlue, uCyan, 0.55 + vCrest * 0.35);
  vec3 foldCol = mix(uPurple, uViolet, 0.4 + vFresnel * 0.2);
  vec3 col = mix(foldCol, crestCol, vMix);
  col += uCyan * core * 0.35;
  float alpha = (core * 0.85 + halo * 0.22) * uOpacity * (0.45 + vGlow * 0.4);
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.92));
}
`;

const FRAG_LINES = /* glsl */ `
uniform vec3 uCyan;
uniform vec3 uBlue;
uniform vec3 uViolet;
uniform vec3 uPurple;
uniform float uOpacity;
varying float vGlow;
varying float vMix;
varying float vFresnel;
varying float vCrest;

void main() {
  // Refined energy beams — cyan accents on neon-blue body, violet in folds.
  vec3 crestCol = mix(uBlue, uCyan, 0.45 + vCrest * 0.4);
  vec3 foldCol = mix(uPurple, uViolet, 0.35);
  vec3 col = mix(foldCol, crestCol, vMix * 0.85 + vFresnel * 0.12);
  float alpha = uOpacity * (0.12 + vGlow * 0.16 + vCrest * 0.08 + vFresnel * 0.1);
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.42));
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
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
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
  private breathVel = 0;
  private deformSmoothed = 0;
  private deformVel = 0;

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
      alpha: false,
      antialias: true,
      powerPreference: "high-performance",
    });
    // Match HUD `--bg0` so bloom sits in the same void as glass panels.
    renderer.setClearColor(ORBIT_LOOK.clearHex, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ORBIT_LOOK.maxPixelRatio));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = ORBIT_LOOK.toneExposure;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(ORBIT_LOOK.clearHex, 0.04);
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);
    camera.position.set(0, 0.1, 4.0);
    this.camera = camera;

    const root = new THREE.Group();
    scene.add(root);
    this.root = root;

    this.buildLayers(root);
    this.buildIdlePoint(root);
    this.buildComposer(renderer, scene, camera);

    this.resizeObserver.observe(host);
    this.resize();
    this.applyPresence("point");
  }

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

  private buildComposer(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
  ): void {
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const bloom = new UnrealBloomPass(
      new THREE.Vector2(512, 512),
      ORBIT_LOOK.bloomStrength,
      ORBIT_LOOK.bloomRadius,
      ORBIT_LOOK.bloomThreshold,
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    this.composer = composer;
    this.bloomPass = bloom;
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
    this.composer?.dispose();
    this.composer = null;
    this.bloomPass = null;
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
    const L = ORBIT_LOOK;
    const configs = [
      {
        detail: L.primaryDetail,
        scale: L.primaryScale,
        lineOp: L.lineOpacityPrimary,
        pointOp: L.pointOpacityPrimary,
      },
      { detail: L.coreDetail, scale: L.coreScale, lineOp: 0.22, pointOp: 0.7 },
      { detail: L.shellDetail, scale: L.shellScale, lineOp: 0.18, pointOp: 0.55 },
    ];

    configs.forEach((cfg, index) => {
      const geo = new THREE.IcosahedronGeometry(1, cfg.detail);
      geo.computeVertexNormals();
      const wire = new THREE.WireframeGeometry(geo);
      const shared = {
        uTime: { value: 0 },
        uEnergy: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uTreble: { value: 0 },
        uSpeakMode: { value: 0 },
        uBright: { value: 0.35 },
        uBreath: { value: 0 },
        uDeform: { value: 0 },
        uLayer: { value: index * 0.42 },
        uCyan: { value: CYAN },
        uBlue: { value: NEON_BLUE },
        uViolet: { value: VIOLET },
        uPurple: { value: PURPLE },
      };

      const lineMat = new THREE.ShaderMaterial({
        uniforms: {
          ...shared,
          uOpacity: { value: cfg.lineOp },
          uIsPoint: { value: 0 },
        },
        vertexShader: VERT,
        fragmentShader: FRAG_LINES,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const pointMat = new THREE.ShaderMaterial({
        uniforms: {
          ...shared,
          uOpacity: { value: cfg.pointOp },
          uIsPoint: { value: 1 },
        },
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
      // Ultra-thin filaments under sharp luminous nodes.
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
      size: 7,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.9,
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ORBIT_LOOK.maxPixelRatio));
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    if (this.bloomPass) {
      this.bloomPass.resolution.set(w, h);
    }
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
    const composer = this.composer;
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

    const breathWave =
      Math.sin(t * T.breathBassHz) * this.bassS * 0.55 + Math.sin(t * T.breathMidHz + 0.7) * this.midS * 0.45;
    const breathTarget = THREE.MathUtils.clamp(
      assistBlend * breathWave * (0.022 + this.energySmoothed * 0.028) +
        userBlend * Math.sin(t * 1.65) * (0.008 + this.energySmoothed * 0.01),
      -T.maxBreath,
      T.maxBreath,
    );
    // Critically-damped spring — fluid breath, no harsh overshoot noise.
    this.breathVel += (breathTarget - this.breathSmoothed) * T.breathSpring;
    this.breathVel *= T.breathDamp;
    this.breathSmoothed = THREE.MathUtils.clamp(
      this.breathSmoothed + this.breathVel,
      -T.maxBreath,
      T.maxBreath,
    );

    const deformTarget = THREE.MathUtils.clamp(
      assistBlend * (0.015 + this.energySmoothed * 0.055 + this.bassS * 0.018),
      0,
      T.maxDeform,
    );
    this.deformVel += (deformTarget - this.deformSmoothed) * T.deformSpring;
    this.deformVel *= T.deformDamp;
    this.deformSmoothed = THREE.MathUtils.clamp(this.deformSmoothed + this.deformVel, 0, T.maxDeform);

    const spinTarget =
      assistBlend > 0.5
        ? THREE.MathUtils.clamp(T.idleSpin + 0.02 + this.energySmoothed * 0.035, T.idleSpin, T.maxSpinAssist)
        : userBlend > 0.5
          ? T.userSpin
          : T.idleSpin;
    this.spinSmoothed = THREE.MathUtils.lerp(this.spinSmoothed, spinTarget, T.lerpSpin);

    root.rotation.y = t * this.spinSmoothed;
    root.rotation.x = Math.sin(t * 0.16) * 0.07 + assistBlend * this.breathSmoothed * 0.28;
    root.rotation.z = Math.cos(t * 0.12) * 0.048;

    const scaleTarget = THREE.MathUtils.clamp(
      1 + this.breathSmoothed + userBlend * this.energySmoothed * 0.015,
      1 - T.maxScaleDelta,
      1 + T.maxScaleDelta,
    );
    this.scaleSmoothed = THREE.MathUtils.lerp(this.scaleSmoothed, scaleTarget, T.lerpScale);
    root.scale.setScalar(this.scaleSmoothed);

    if (this.bloomPass) {
      const bloomStrength = ORBIT_LOOK.bloomStrength + assistBlend * 0.05 + userBlend * 0.03;
      this.bloomPass.strength = THREE.MathUtils.clamp(bloomStrength, 0.42, 0.62);
      this.bloomPass.radius = ORBIT_LOOK.bloomRadius;
      this.bloomPass.threshold = ORBIT_LOOK.bloomThreshold;
    }

    for (const layer of this.layers) {
      const brightBoost = 1 + (this.brightSmoothed - 0.35) * 0.28;
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
      layer.lineMat.uniforms.uOpacity.value = Math.min(0.4, layer.baseLineOp * brightBoost);
      layer.pointMat.uniforms.uOpacity.value = Math.min(0.9, layer.basePointOp * brightBoost);
    }

    if (this.coreMat) {
      this.coreMat.opacity = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.8));
      this.coreMat.size = 5 + Math.sin(t * 1.8) * 1.2;
    }

    if (composer) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
  }
}
