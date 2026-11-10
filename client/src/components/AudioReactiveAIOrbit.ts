/**
 * AudioReactiveAIOrbit — single high-poly plexus sphere for the Aether HUD.
 * ONE Icosahedron (shared Mesh wireframe + Points), UnrealBloomPass, HUD palette.
 * Driven by WS / VAD / playback AnalyserNode taps — never touches PCM uplink.
 *
 * Physics:
 *  - Frequency focus: 100–2000Hz voice band → lerped RMS / avg amplitude.
 *  - Idle: perfect sphere + slow axis rotation (vertices restored to base).
 *  - Speak: every vertex displaced with composite 3D noise × voice intensity;
 *    Points + wireframe share one BufferGeometry (needsUpdate each speak frame).
 */

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { VisualizerMode } from "../audio/AdvancedAudioVisualizer";

export type OrbitPresence = "point" | "full";

/** Speak mode for drive: 0 idle, 1 user/VAD, 2 assistant/playback. */
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
  /** Explicit 100–2000Hz voice-band energy (preferred over level). */
  voiceBand?: number;
}

export type OrbitDriver = () => OrbitDriveState;

/**
 * Calm elegant motion — heavy lerp damping, tiny radial deform.
 * Idle ≈ almost still; speak = gentle breath, not wild wobble.
 */
export const ORBIT_TUNING = {
  /** Low alphas = stronger damping / slower response. */
  lerpRms: 0.035,
  lerpSpeakMode: 0.03,
  lerpBright: 0.025,
  lerpScale: 0.03,
  lerpSpin: 0.025,
  lerpDeform: 0.04,
  lerpBreath: 0.035,
  lerpVoice: 0.04,
  maxEnergy: 0.38,
  /** Radial displace clamp — subtle surface only. */
  maxDeform: 0.022,
  maxBreath: 0.01,
  maxScaleDelta: 0.012,
  maxSpinAssist: 0.04,
  /** Idle: almost still; speak: barely faster. */
  idleSpin: 0.018,
  speakSpin: 0.026,
  breathHz: 0.55,
  noiseHz: 0.42,
  /** Spatial frequencies (lower = broader, calmer waves). */
  noiseA: 2.0,
  noiseB: 1.7,
  noiseC: 2.4,
  /** Peak |noise| gain before × deform amp. */
  noiseGain: 0.55,
  /** Secondary axis tilt (radians) — keep tiny. */
  tiltX: 0.012,
  tiltZ: 0.008,
} as const;

/**
 * Single-sphere plexus look — HUD-harmonized palette + elegant bloom.
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

const CYAN = new THREE.Color("#00f3ff");
const NEON_BLUE = new THREE.Color("#3aa7ff");
const PURPLE = new THREE.Color("#7000ff");
const VIOLET = new THREE.Color("#8b5cff");

/**
 * Vertex shading assumes CPU already deformed `position`.
 * Fresnel / crest still animate with uniforms for luminous HUD glow.
 */
const VERT = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
uniform float uSpeakMode;
uniform float uBright;
uniform float uBreath;
uniform float uIsPoint;

varying float vGlow;
varying float vMix;
varying float vFresnel;
varying float vCrest;

void main() {
  vec3 pos = position;
  float speak = smoothstep(0.35, 1.2, uSpeakMode);
  pos *= 1.0 + uBreath * 0.35;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vec3 viewDir = normalize(-mv.xyz);
  vec3 nView = normalize(normalMatrix * normalize(position));
  float fres = pow(1.0 - clamp(abs(dot(viewDir, nView)), 0.0, 1.0), 1.55);

  float lat = atan(position.z, position.x);
  float elev = asin(clamp(position.y / max(length(position), 1e-4), -1.0, 1.0));
  float crest = clamp(0.5 + 0.5 * sin(elev * 3.0 + lat * 2.0 + uTime * 0.9), 0.0, 1.0);
  float depth = clamp((-mv.z - 2.4) * 0.22, 0.0, 1.0);
  vCrest = crest;
  vMix = clamp(crest * 0.55 + fres * 0.55 - depth * 0.35, 0.0, 1.0);
  vFresnel = fres;
  vGlow = 0.3 + uBright * 0.38 + fres * 0.4 + crest * 0.18 + speak * uEnergy * 0.14;

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
  vec3 crestCol = mix(uBlue, uCyan, 0.45 + vCrest * 0.4);
  vec3 foldCol = mix(uPurple, uViolet, 0.35);
  vec3 col = mix(foldCol, crestCol, vMix * 0.85 + vFresnel * 0.12);
  float alpha = uOpacity * (0.12 + vGlow * 0.16 + vCrest * 0.08 + vFresnel * 0.1);
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.42));
}
`;

interface LayerBundle {
  /** Shared geometry — Points + wireframe Mesh both read these positions. */
  geometry: THREE.BufferGeometry;
  basePositions: Float32Array;
  positions: THREE.BufferAttribute;
  points: THREE.Points;
  wire: THREE.Mesh;
  pointMat: THREE.ShaderMaterial;
  lineMat: THREE.ShaderMaterial;
  baseScale: number;
  baseLineOp: number;
  basePointOp: number;
}

/** Composite 3D noise — soft coherent undulation (gain-scaled, not wild). */
export function compositeVertexNoise(
  x: number,
  y: number,
  z: number,
  t: number,
  T: typeof ORBIT_TUNING = ORBIT_TUNING,
): number {
  const g = T.noiseGain;
  const a =
    Math.sin(x * T.noiseA + t * 0.9) * Math.cos(y * T.noiseB - t * 0.7) * (0.4 * g);
  const b = Math.sin(y * T.noiseC + z * 1.4 + t * 1.05) * (0.28 * g);
  const c =
    Math.sin((x + z) * 2.8 - t * 0.55) * Math.cos(y * 2.0 + t * 0.45) * (0.22 * g);
  return THREE.MathUtils.clamp(a + b + c, -1, 1);
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
  private voiceSmoothed = 0;
  private lowMidSmoothed = 0;
  private speakModeSmoothed = 0;
  private brightSmoothed = 0.35;
  private scaleSmoothed = 1;
  private spinSmoothed: number = ORBIT_TUNING.idleSpin;
  private breathSmoothed = 0;
  private deformSmoothed = 0;
  private idleRestored = true;

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
      layer.geometry.dispose();
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

  /**
   * Exactly one high-poly plexus sphere.
   * Mesh(wireframe) + Points share one BufferGeometry so CPU deform stays coherent.
   */
  private buildLayers(root: THREE.Group): void {
    const L = ORBIT_LOOK;
    const geo = new THREE.IcosahedronGeometry(1, L.detail);
    geo.computeVertexNormals();
    const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
    const basePositions = new Float32Array(posAttr.array as Float32Array);

    const shared = {
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uSpeakMode: { value: 0 },
      uBright: { value: 0.35 },
      uBreath: { value: 0 },
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
      wireframe: true,
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

    // Same geometry → one needsUpdate moves every luminous node + wire edge together.
    const wire = new THREE.Mesh(geo, lineMat);
    const points = new THREE.Points(geo, pointMat);
    wire.scale.setScalar(L.scale);
    points.scale.setScalar(L.scale);
    root.add(wire);
    root.add(points);

    this.layers.push({
      geometry: geo,
      basePositions,
      positions: posAttr,
      points,
      wire,
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
      layer.wire.visible = full;
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

  /**
   * Displace every vertex along its radial normal with clamped composite noise.
   * Sets `position.needsUpdate` so Points + wireframe Mesh stay locked together.
   */
  private applyVertexDeform(layer: LayerBundle, t: number, intensity: number): void {
    const T = ORBIT_TUNING;
    const base = layer.basePositions;
    const arr = layer.positions.array as Float32Array;
    const amp = THREE.MathUtils.clamp(intensity, 0, T.maxDeform);

    if (amp < 1e-5) {
      if (!this.idleRestored) {
        arr.set(base);
        layer.positions.needsUpdate = true;
        this.idleRestored = true;
      }
      return;
    }

    this.idleRestored = false;
    const noiseT = t * T.noiseHz;
    for (let i = 0; i < arr.length; i += 3) {
      const bx = base[i];
      const by = base[i + 1];
      const bz = base[i + 2];
      const len = Math.hypot(bx, by, bz) || 1;
      const nx = bx / len;
      const ny = by / len;
      const nz = bz / len;
      const n = compositeVertexNoise(nx, ny, nz, noiseT, T);
      // Safe radial clamp — sphere keeps coherent 3D shape.
      const d = THREE.MathUtils.clamp(n * amp, -T.maxDeform, T.maxDeform);
      arr[i] = bx + nx * d;
      arr[i + 1] = by + ny * d;
      arr[i + 2] = bz + nz * d;
    }
    layer.positions.needsUpdate = true;
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
      voiceBand: 0,
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

    // 100–2000Hz voice band → smoothed RMS / avg (prefer explicit voiceBand).
    const voiceRaw =
      speakMode === 2
        ? (drive.voiceBand ?? drive.playLevel)
        : speakMode === 1
          ? (drive.voiceBand ?? drive.micLevel)
          : 0;
    const rmsRaw =
      speakMode === 2 ? drive.playLevel : speakMode === 1 ? drive.micLevel : 0;
    const lowMidRaw =
      speakMode === 2
        ? drive.bass * 0.45 + drive.mid * 0.55
        : speakMode === 1
          ? (drive.voiceBand ?? drive.micLevel) * 0.75
          : 0;

    this.voiceSmoothed = THREE.MathUtils.lerp(
      this.voiceSmoothed,
      THREE.MathUtils.clamp(voiceRaw, 0, 1),
      T.lerpVoice,
    );
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
      speaking
        ? this.voiceSmoothed * 0.4 + this.rmsSmoothed * 0.15 + this.lowMidSmoothed * 0.15
        : 0,
      0,
      T.maxEnergy,
    );
    this.energySmoothed = THREE.MathUtils.lerp(this.energySmoothed, energyTarget, T.lerpRms);
    this.speakModeSmoothed = THREE.MathUtils.lerp(this.speakModeSmoothed, speakMode, T.lerpSpeakMode);

    const brightTarget = speaking ? 0.36 + this.energySmoothed * 0.12 : 0.32;
    this.brightSmoothed = THREE.MathUtils.lerp(this.brightSmoothed, brightTarget, T.lerpBright);

    this.applyPresence(full ? "full" : "point");

    const t = this.clock.getElapsedTime();
    const speakBlend = THREE.MathUtils.smoothstep(this.speakModeSmoothed, 0.4, 1.35);

    // Gentle breathing only — small scale pulse tied to voice.
    const breathTarget = THREE.MathUtils.clamp(
      speakBlend *
        Math.sin(t * T.breathHz) *
        (0.003 + this.voiceSmoothed * 0.008 + this.energySmoothed * 0.004),
      -T.maxBreath,
      T.maxBreath,
    );
    this.breathSmoothed = THREE.MathUtils.lerp(this.breathSmoothed, breathTarget, T.lerpBreath);

    // Subtle radial undulation (clamped hard by maxDeform).
    const deformTarget = THREE.MathUtils.clamp(
      speakBlend *
        (0.004 + this.voiceSmoothed * 0.014 + this.energySmoothed * 0.008 + this.lowMidSmoothed * 0.004),
      0,
      T.maxDeform,
    );
    this.deformSmoothed = THREE.MathUtils.lerp(this.deformSmoothed, deformTarget, T.lerpDeform);

    const spinTarget = speaking
      ? THREE.MathUtils.clamp(T.speakSpin + this.voiceSmoothed * 0.006, T.idleSpin, T.maxSpinAssist)
      : T.idleSpin;
    this.spinSmoothed = THREE.MathUtils.lerp(this.spinSmoothed, spinTarget, T.lerpSpin);

    // Idle: almost-still slow Y rotate. Tiny tilt; speak adds soft breath via vertices.
    root.rotation.y = t * this.spinSmoothed;
    root.rotation.x = Math.sin(t * 0.08) * T.tiltX;
    root.rotation.z = Math.cos(t * 0.06) * T.tiltZ;

    const scaleTarget = THREE.MathUtils.clamp(
      1 + this.breathSmoothed,
      1 - T.maxScaleDelta,
      1 + T.maxScaleDelta,
    );
    this.scaleSmoothed = THREE.MathUtils.lerp(this.scaleSmoothed, scaleTarget, T.lerpScale);
    root.scale.setScalar(this.scaleSmoothed);

    if (this.bloomPass) {
      const bloomStrength = ORBIT_LOOK.bloomStrength + speakBlend * 0.02;
      this.bloomPass.strength = THREE.MathUtils.clamp(bloomStrength, 0.45, 0.56);
      this.bloomPass.radius = ORBIT_LOOK.bloomRadius;
      this.bloomPass.threshold = ORBIT_LOOK.bloomThreshold;
    }

    for (const layer of this.layers) {
      this.applyVertexDeform(layer, t, this.deformSmoothed);

      const brightBoost = 1 + (this.brightSmoothed - 0.35) * 0.28;
      for (const mat of [layer.pointMat, layer.lineMat]) {
        mat.uniforms.uTime.value = t;
        mat.uniforms.uEnergy.value = this.energySmoothed;
        mat.uniforms.uSpeakMode.value = this.speakModeSmoothed;
        mat.uniforms.uBright.value = this.brightSmoothed;
        mat.uniforms.uBreath.value = this.breathSmoothed;
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
