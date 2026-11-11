/**
 * AetherVisualCore — React Three Fiber holographic AI presence.
 * Faithful port of the pasted HolographicSphere (icosahedron wireframe,
 * cyan/violet, core glow, data rings, particles, status strip).
 * Soft-FPS: reused temps, capped DPR, modest icosa detail for HUD daily use.
 */
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";

export type VisualCoreDrive = {
  isSpeaking: boolean;
  /** Playback analyser energy 0–1. */
  audioIntensity: number;
};

export type VisualCoreDriveRef = MutableRefObject<VisualCoreDrive>;

const PARTICLES = 300;
/** Detail 12 keeps dense wireframe look without the paste's detail-32 vertex thrash. */
const ICOSA_DETAIL = 12;

function HolographicSphere({ drive }: { drive: VisualCoreDriveRef }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const coreMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const wireMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const vertex = useMemo(() => new THREE.Vector3(), []);

  const sphereGeometry = useMemo(() => new THREE.IcosahedronGeometry(1.5, ICOSA_DETAIL), []);

  const [particlePositions, particleOriginals] = useMemo(() => {
    const pos = new Float32Array(PARTICLES * 3);
    const orig = new Float32Array(PARTICLES * 3);
    for (let i = 0; i < PARTICLES * 3; i += 3) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 1.8 + Math.random() * 0.8;

      pos[i] = r * Math.sin(phi) * Math.cos(theta);
      pos[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i + 2] = r * Math.cos(phi);

      orig[i] = pos[i];
      orig[i + 1] = pos[i + 1];
      orig[i + 2] = pos[i + 2];
    }
    return [pos, orig] as const;
  }, []);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const { isSpeaking, audioIntensity } = drive.current;
    const intensity = isSpeaking ? Math.max(0.2, audioIntensity) : 0.05;

    if (ring1Ref.current) ring1Ref.current.rotation.z = time * 0.3;
    if (ring2Ref.current) ring2Ref.current.rotation.x = time * -0.2;

    if (wireMatRef.current) {
      wireMatRef.current.emissiveIntensity = isSpeaking ? 0.8 : 0.3;
    }
    if (coreMatRef.current) {
      coreMatRef.current.opacity = isSpeaking ? 0.15 : 0.05;
    }

    if (meshRef.current) {
      meshRef.current.rotation.y = time * 0.15;
      const positionAttr = meshRef.current.geometry.attributes.position;
      for (let i = 0; i < positionAttr.count; i++) {
        vertex.fromBufferAttribute(positionAttr, i);
        const noise = Math.sin(time * 4 + i * 0.5) * intensity * 0.2;
        vertex.normalize().multiplyScalar(1.5 + noise);
        positionAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);
      }
      positionAttr.needsUpdate = true;
    }

    if (particlesRef.current) {
      particlesRef.current.rotation.y = time * -0.05;
      const pAttr = particlesRef.current.geometry.attributes.position;
      for (let i = 0; i < PARTICLES; i++) {
        const i3 = i * 3;
        const pulse = Math.sin(time * 3 + i) * intensity * 0.1;
        pAttr.setXYZ(
          i3,
          particleOriginals[i3] * (1 + pulse),
          particleOriginals[i3 + 1] * (1 + pulse),
          particleOriginals[i3 + 2] * (1 + pulse),
        );
      }
      pAttr.needsUpdate = true;
    }
  });

  return (
    <group>
      <mesh ref={meshRef} geometry={sphereGeometry}>
        <meshStandardMaterial
          ref={wireMatRef}
          color="#00f0ff"
          emissive="#7000ff"
          emissiveIntensity={0.3}
          wireframe
          transparent
          opacity={0.65}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[1.3, 16, 16]} />
        <meshBasicMaterial ref={coreMatRef} color="#00f0ff" transparent opacity={0.05} />
      </mesh>

      <mesh ref={ring1Ref}>
        <ringGeometry args={[2.2, 2.25, 64]} />
        <meshBasicMaterial color="#00f0ff" side={THREE.DoubleSide} transparent opacity={0.4} />
      </mesh>

      <mesh ref={ring2Ref} rotation={[Math.PI / 3, 0, 0]}>
        <ringGeometry args={[2.5, 2.53, 64]} />
        <meshBasicMaterial color="#7000ff" side={THREE.DoubleSide} transparent opacity={0.3} />
      </mesh>

      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particlePositions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.04} color="#00f0ff" transparent opacity={0.7} />
      </points>
    </group>
  );
}

/** DOM status strip — rAF sync from mutable drive (no Tailwind / no drei Html). */
function StatusStrip({ drive }: { drive: VisualCoreDriveRef }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const valRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      const wrap = wrapRef.current;
      const val = valRef.current;
      if (wrap && val) {
        const speaking = drive.current.isSpeaking;
        wrap.dataset.speaking = speaking ? "true" : "false";
        const next = speaking ? "SYNCHRONIZED [SPEAKING]" : "STANDBY [IDLE]";
        if (val.textContent !== next) val.textContent = next;
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => {
      alive = false;
      window.cancelAnimationFrame(raf);
    };
  }, [drive]);

  return (
    <div ref={wrapRef} className="ai-orbit-status" data-speaking="false">
      CORE STATUS: <span ref={valRef} className="ai-orbit-status-val">STANDBY [IDLE]</span>
    </div>
  );
}

/**
 * Full-bleed HUD mount. Drive is a mutable ref so Live analyser energy
 * updates without React re-renders every frame.
 */
export default function AetherVisualCore({ drive }: { drive: VisualCoreDriveRef }) {
  return (
    <div className="ai-orbit-visual-root">
      <Canvas
        className="ai-orbit-canvas"
        camera={{ position: [0, 0, 5], fov: 60 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        style={{ width: "100%", height: "100%" }}
      >
        <ambientLight intensity={0.8} />
        <pointLight position={[10, 10, 10]} intensity={1.5} color="#00f0ff" />
        <pointLight position={[-10, -10, -10]} intensity={0.8} color="#7000ff" />
        <HolographicSphere drive={drive} />
      </Canvas>
      <StatusStrip drive={drive} />
    </div>
  );
}
