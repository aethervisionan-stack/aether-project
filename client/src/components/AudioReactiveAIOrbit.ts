/**
 * AudioReactiveAIOrbit — single high-poly plexus sphere for the Aether HUD.
 * ONE Icosahedron wireframe (LineSegments + Points), UnrealBloomPass, HUD palette.
 * Driven by WS / VAD / playback AnalyserNode taps — never touches PCM uplink.
 *
 * Physics:
 *  - Idle: round sphere + slow axis rotation (no vertex deform).
 *  - Speaking: keep rotate + gentle sine undulation from smoothed RMS / low-mid.
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
 * Constant damping via MathUtils.lerp — no hard jumps on scale / deform.
 * Energy from smoothed output RMS + low-mid; clamps keep breath subtle.
 */
export const ORBIT_TUNING = {
  /** Constant lerp alphas (rAF). */
  lerpRms: 0.06,
  lerpSpeakMode: 0.05,
  lerpBright: 0.04,
  lerpScale: 0.06,
  lerpSpin: 0.045,
  lerpDeform: 0.055,
  lerpBreath: 0.06,
  maxEnergy: 0.55,
  maxDeform: 0.055,
  maxBreath: 0.032,
  maxScaleDelta: 0.04,
  maxSpinAssist: 0.12,
  idleSpin: 0.08,
  speakSpin: 0.1,
  /** Soft speech sine frequencies. */
  breathHz: 1.25,
  waveHz: 0.85,
} as const;

/**
 * Single-sphere plexus look — HUD-harmonized palette + elegant bloom.
 * Hexes mirror `main.css` :root tokens (`--cyan`, `--purple`, `--bg0`).
 */
export const ORBIT_LOOK = {
  /** Icosahedron detail: faces = 20 * 4^detail — one sphere only. */
  detail: 6, // 81 920 faces
  scale: 1.0,
  maxPixelRatio: 1.75,
  bloomStrength: 0.52,
  bloomRadius: 0.42,
  bloomThreshold: 0.32,
  lineOpacity: 0.28,
  pointOpacity: 0.78,
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
uniform float uSpeakMode;
uniform float uBright;
uniform float uBreath;
uniform float uDeform;
uniform float uWaveHz;
uniform float uIsPoint; // 1 = Points, 0 = LineSegments

varying float vGlow;
varying float vMix;
varying float vFresnel;
varying float vCrest;

void main() {
  vec3 pos = position;
  float speak = smoothstep(0.35, 1.2, uSpeakMode);

  // Soft coherent sine undulation (not chaotic noise) — gated by uDeform.
  float lat = atan(position.z, position.x);
  float elev = asin(clamp(position.y, -1.0, 1.0));
  float wave =
    sin(elev * 4.0 + uTime * uWaveHz) * 0.55 +
    sin(lat * 3.0 - uTime * uWaveHz * 0.7) * 0.35 +
    sin((elev + lat) * 2.0 + uTime * uWaveHz * 0.45) * 0.2;
  wave = clamp(wave, -1.0, 1.0);

  float deform = wave * uDeform * speak;
  pos *= 1.0 + uBreath;
  pos += normalize(position + 1e-5) * deform;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vec3 viewDir = normalize(-mv.xyz);
  vec3 nView = normalize(normalMatrix * normalize(position));
  float fres = pow(1.0 - clamp(abs(dot(viewDir, nView)), 0.0, 1.0), 1.55);

  // Depth from shaders only: cyan crests / violet folds via fresnel + wave.
  float crest = clamp(wave * 0.5 + 0.5, 0.0, 1.0);
  float depth = clamp((-mv.z - 2.4) * 0.22, 0.0, 1.0);
  vCrest = crest;
  vMix = clamp(crest * 0.55 + fres * 0.55 - depth * 0.35, 0.0, 1.0);
  vFresnel = fres;
  vGlow = 0.3 + uBright * 0.38 + fres * 0.4 + crest * 0.18 + speak * uEnergy * 0.12;

  gl_Position = projectionMatrix * mv;
  float pt = mix(0.0, 1.05 + uBright * 1.15 + fres * 1.2 + crest * 0.4, uIsPoint);
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
  private rmsSmoothed = 0;
  private lowMidSmoothed = 0;
  private speakModeSmoothed = 0;
  private brightSmoothed = 0.35;
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

  /** Exactly one high-poly plexus sphere — depth from shaders only. */
  private buildLayers(root: THREE.Group): void {
    const L = ORBIT_LOOK;
    const geo = new THREE.IcosahedronGeometry(1, L.detail);
    geo.computeVertexNormals();
    const wire = new THREE.WireframeGeometry(geo);
    const shared = {
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uSpeakMode: { value: 0 },
      uBright: { value: 0.35 },
      uBreath: { value: 0 },
      uDeform: { value: 0 },
      uWaveHz: { value: ORBIT_TUNING.waveHz },
      uCyan: { value: CYAN },
      uBlue: { value: NEON_BLUE },
      uViolet: { value: VIOLET },
      uPurple: { value: PURPLE },
    };

    const lineMat = new THREE.ShaderMaterial({
      uniforms: {
        ...shared,
        uOpacity: { value: L.lineOpacity },
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
        uOpacity: { value: L.pointOpacity },
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
    lines.scale.setScalar(L.scale);
    points.scale.setScalar(L.scale);
    root.add(lines);
    root.add(points);

    this.layers.push({
      points,
      lines,
      pointMat,
      lineMat,
      baseScale: L.scale,
      baseLineOp: L.lineOpacity,
      basePointOp: L.pointOpacity,
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
    const speaking = speakMode !== 0;
    const full =
      drive.wsOpen ||
      drive.vadSpeech ||
      drive.playbackActive ||
      drive.mode === "speaking" ||
      drive.mode === "listening";

    // Smoothed output RMS + low-mid — constant damping, no hard jumps.
    const rmsRaw =
      speakMode === 2
        ? drive.playLevel
        : speakMode === 1
          ? drive.micLevel
          : 0;
    const lowMidRaw =
      speakMode === 2
        ? drive.bass * 0.55 + drive.mid * 0.45
        : speakMode === 1
          ? drive.micLevel * 0.7
          : 0;
    this.rmsSmoothed = THREE.MathUtils.lerp(
      this.rmsSmoothed,
      THREE.MathUtils.clamp(rmsRaw, 0, 1),
      T.lerpRms,
    );
    this.lowMidSmoothed = THREE.MathUtils.lerp(
      this.lowMidSmoothed,
      THREE.MathUtils.clamp(lowMidRaw, 0, 1),
      T.lerpRms,
    );
    const energyTarget = THREE.MathUtils.clamp(
      speaking ? this.rmsSmoothed * 0.55 + this.lowMidSmoothed * 0.55 : 0,
      0,
      T.maxEnergy,
    );
    this.energySmoothed = THREE.MathUtils.lerp(this.energySmoothed, energyTarget, T.lerpRms);
    this.speakModeSmoothed = THREE.MathUtils.lerp(this.speakModeSmoothed, speakMode, T.lerpSpeakMode);

    const brightTarget = speaking ? 0.4 + this.energySmoothed * 0.25 : 0.32;
    this.brightSmoothed = THREE.MathUtils.lerp(this.brightSmoothed, brightTarget, T.lerpBright);

    this.applyPresence(full ? "full" : "point");

    const t = this.clock.getElapsedTime();
    const speakBlend = THREE.MathUtils.smoothstep(this.speakModeSmoothed, 0.35, 1.2);

    // Soft expand/contract breath tied to smoothed RMS / low-mid.
    const breathTarget = THREE.MathUtils.clamp(
      speakBlend * Math.sin(t * T.breathHz) * (0.012 + this.energySmoothed * 0.028),
      -T.maxBreath,
      T.maxBreath,
    );
    this.breathSmoothed = THREE.MathUtils.lerp(this.breathSmoothed, breathTarget, T.lerpBreath);

    // Idle → deform 0 (round). Speaking → gentle surface undulation.
    const deformTarget = THREE.MathUtils.clamp(
      speakBlend * (0.012 + this.energySmoothed * 0.042 + this.lowMidSmoothed * 0.02),
      0,
      T.maxDeform,
    );
    this.deformSmoothed = THREE.MathUtils.lerp(this.deformSmoothed, deformTarget, T.lerpDeform);

    const spinTarget = speaking
      ? THREE.MathUtils.clamp(T.speakSpin + this.energySmoothed * 0.02, T.idleSpin, T.maxSpinAssist)
      : T.idleSpin;
    this.spinSmoothed = THREE.MathUtils.lerp(this.spinSmoothed, spinTarget, T.lerpSpin);

    root.rotation.y = t * this.spinSmoothed;
    root.rotation.x = Math.sin(t * 0.15) * 0.06;
    root.rotation.z = Math.cos(t * 0.11) * 0.04;

    const scaleTarget = THREE.MathUtils.clamp(
      1 + this.breathSmoothed,
      1 - T.maxScaleDelta,
      1 + T.maxScaleDelta,
    );
    this.scaleSmoothed = THREE.MathUtils.lerp(this.scaleSmoothed, scaleTarget, T.lerpScale);
    root.scale.setScalar(this.scaleSmoothed);

    if (this.bloomPass) {
      const bloomStrength = ORBIT_LOOK.bloomStrength + speakBlend * 0.04;
      this.bloomPass.strength = THREE.MathUtils.clamp(bloomStrength, 0.42, 0.6);
      this.bloomPass.radius = ORBIT_LOOK.bloomRadius;
      this.bloomPass.threshold = ORBIT_LOOK.bloomThreshold;
    }

    for (const layer of this.layers) {
      const brightBoost = 1 + (this.brightSmoothed - 0.35) * 0.28;
      for (const mat of [layer.pointMat, layer.lineMat]) {
        mat.uniforms.uTime.value = t;
        mat.uniforms.uEnergy.value = this.energySmoothed;
        mat.uniforms.uSpeakMode.value = this.speakModeSmoothed;
        mat.uniforms.uBright.value = this.brightSmoothed;
        mat.uniforms.uBreath.value = this.breathSmoothed;
        mat.uniforms.uDeform.value = this.deformSmoothed;
        mat.uniforms.uWaveHz.value = T.waveHz;
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
