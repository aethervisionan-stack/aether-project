/**
 * Inspeção de endpoints de áudio (HFP/HSP vs A2DP) e recuperação do
 * AudioContext depois de o Bluetooth derrubar o grafo.
 *
 * O Windows publica o mesmo fone duas vezes: Hands-Free / AG Audio tem
 * microfone; Stereo (A2DP) é só reprodução. getUserMedia só funciona no primeiro.
 */

export type BluetoothProfile = "hfp" | "a2dp" | "unknown";

export type AudioEndpointRole = "physical" | "default" | "communications";

export interface AudioDeviceInspection {
  kind: MediaDeviceKind;
  label: string;
  deviceId: string;
  groupId: string;
  profile: BluetoothProfile;
  profileLabel: string;
  endpoint: AudioEndpointRole;
  labelHidden: boolean;
}

export interface BluetoothCaptureAssessment {
  level: "ok" | "warn" | "info";
  text: string;
}

export interface AudioContextResetResult {
  previous: string;
  current: string;
  action: "resumed" | "recreated" | "created" | "unsupported";
}

const HFP_MARKERS = [
  "hands-free",
  "handsfree",
  "hands free",
  "mãos-livres",
  "maos-livres",
  "mãos livres",
  "maos livres",
  "ag audio",
  "áudio ag",
  "audio ag",
  "hfp",
  "hsp",
];

const A2DP_MARKERS = [
  "a2dp",
  "stereo",
  "estéreo",
  "estereo",
  "high quality",
  "alta qualidade",
];

function earliest(haystack: string, markers: string[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const marker of markers) {
    const at = haystack.indexOf(marker);
    if (at >= 0 && at < best) best = at;
  }
  return best;
}

/** Classifica o perfil Bluetooth a partir do label que o browser expõe. */
export function classifyBluetoothProfile(label: string): BluetoothProfile {
  const lower = label.toLowerCase();
  if (!lower.trim()) return "unknown";
  const hfp = HFP_MARKERS.some((marker) => lower.includes(marker));
  const a2dp = A2DP_MARKERS.some((marker) => lower.includes(marker));
  if (hfp && !a2dp) return "hfp";
  if (a2dp && !hfp) return "a2dp";
  if (hfp && a2dp) {
    return earliest(lower, HFP_MARKERS) <= earliest(lower, A2DP_MARKERS) ? "hfp" : "a2dp";
  }
  if (lower.includes("headset")) return "hfp";
  if (lower.includes("headphone")) return "a2dp";
  return "unknown";
}

export function profileCaption(profile: BluetoothProfile): string {
  switch (profile) {
    case "hfp":
      return "Hands-Free / AG Audio (HFP/HSP)";
    case "a2dp":
      return "A2DP Stereo";
    default:
      return "Perfil não identificado";
  }
}

function endpointRole(deviceId: string): AudioEndpointRole {
  if (deviceId === "default") return "default";
  if (deviceId === "communications") return "communications";
  return "physical";
}

export function describeAudioDevice(device: MediaDeviceInfo): AudioDeviceInspection {
  const label = device.label?.trim() ?? "";
  const profile = classifyBluetoothProfile(label);
  return {
    kind: device.kind,
    label,
    deviceId: device.deviceId,
    groupId: device.groupId,
    profile,
    profileLabel: profileCaption(profile),
    endpoint: endpointRole(device.deviceId),
    labelHidden: label.length === 0,
  };
}

/** Todas as entradas e saídas de áudio, com perfil Bluetooth inferido pelo label. */
export async function inspectAudioDevices(): Promise<AudioDeviceInspection[]> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
    return [];
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === "audioinput" || device.kind === "audiooutput")
    .map(describeAudioDevice);
}

/**
 * Leitura rápida para o HUD: a captura do M100 precisa de um audioinput HFP.
 * Saída A2DP sozinha não serve de microfone.
 */
const BLUETOOTH_LABEL_TOKENS = [
  "bluetooth",
  "hands-free",
  "handsfree",
  "hands free",
  "ag audio",
  "m100",
  "a2dp",
];

/**
 * O browser não lê WinRT. Sem nenhum endpoint Bluetooth, o sintoma é o mesmo
 * de NO_BT_RADIO / Generic Bluetooth Adapter em CM_PROB_PHANTOM.
 */
export function isBluetoothRadioMissing(devices: AudioDeviceInspection[]): boolean {
  if (devices.length > 0 && devices.every((device) => device.labelHidden)) {
    return false;
  }
  return !devices.some((device) => {
    const label = device.label.toLowerCase();
    return BLUETOOTH_LABEL_TOKENS.some((token) => label.includes(token));
  });
}

export function assessBluetoothCapture(
  devices: AudioDeviceInspection[],
): BluetoothCaptureAssessment {
  if (!devices.length) {
    return {
      level: "warn",
      text: "enumerateDevices não devolveu entradas nem saídas. O adaptador pode estar desligado, ou o browser ainda não tem mediaDevices.",
    };
  }
  const inputs = devices.filter((device) => device.kind === "audioinput");
  if (inputs.length === 0) {
    return {
      level: "warn",
      text: "Nenhuma entrada de áudio visível para o browser — só há saídas. O M100 não está exposto como microfone Hands-Free, por isso getUserMedia devolve NotFoundError. Ligue o fone, confirme o endpoint em Som → Gravação e re-enumere.",
    };
  }
  const labelsHidden = devices.every((device) => device.labelHidden);
  if (labelsHidden) {
    return {
      level: "info",
      text: "Dispositivos visíveis, mas os labels estão ocultos. Conceda a permissão de microfone e force a re-enumeração para distinguir Hands-Free de A2DP.",
    };
  }
  const hfpInputs = devices.filter(
    (device) => device.kind === "audioinput" && device.profile === "hfp",
  );
  const a2dpOutputs = devices.filter(
    (device) => device.kind === "audiooutput" && device.profile === "a2dp",
  );
  if (hfpInputs.length > 0) {
    const names = hfpInputs
      .map((device) => device.label)
      .filter((label) => label.length > 0)
      .slice(0, 2)
      .join(" · ");
    return {
      level: "ok",
      text: names
        ? `Entrada Hands-Free disponível para captura: ${names}.`
        : "Entrada Hands-Free / AG Audio disponível para getUserMedia.",
    };
  }
  if (a2dpOutputs.length > 0) {
    return {
      level: "warn",
      text: "Há saída A2DP Stereo e nenhuma entrada Hands-Free. Esse perfil não tem microfone — getUserMedia tende a falhar com NotFoundError ou NotReadableError até o Windows expor o endpoint HFP/HSP.",
    };
  }
  return {
    level: "info",
    text: "Nenhum label Hands-Free ou A2DP reconhecido. Confira no SO se o M100 está ligado como auricular (não só como auscultador estéreo).",
  };
}

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const extra = window as Window & { webkitAudioContext?: AudioContextCtor };
  return window.AudioContext ?? extra.webkitAudioContext ?? null;
}

let sharedContext: AudioContext | null = null;

export function readAudioContextState(): string {
  if (!audioContextCtor()) return "unsupported";
  return sharedContext?.state ?? "none";
}

function isStaleContextState(state: string): boolean {
  return state === "suspended" || state === "interrupted";
}

/** Resume se o contexto só estiver suspenso; usado antes de reproduzir TTS. */
export async function ensureAudioContextRunning(): Promise<string> {
  const Ctor = audioContextCtor();
  if (!Ctor) return "unsupported";
  if (!sharedContext || sharedContext.state === "closed") {
    sharedContext = new Ctor();
  }
  if (isStaleContextState(sharedContext.state)) {
    await sharedContext.resume();
  }
  return sharedContext.state;
}

/**
 * Call synchronously inside a click/touch handler (start/stop record).
 * Unlocks WebAudio so later TTS `audio.play()` is not autoplay-blocked on phones.
 */
export async function unlockAudioForGesture(): Promise<string> {
  const state = await ensureAudioContextRunning();
  console.log("[aether:stage] audio.unlock_gesture", { state });
  // Prime speechSynthesis voices while we still have a user gesture (iOS/Safari).
  try {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      // Tiny no-op utterance keeps the speech engine warm on some mobile browsers.
      window.speechSynthesis.cancel();
    }
  } catch (err) {
    console.warn("[aether:stage] audio.unlock_speech_warm", err);
  }
  // Silent <audio> play inside the gesture — unlocks HTMLMediaElement autoplay on mobile.
  try {
    if (typeof window !== "undefined" && typeof Audio !== "undefined") {
      const silent = new Audio(
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=",
      );
      silent.volume = 0.01;
      await silent.play().catch(() => undefined);
      silent.pause();
    }
  } catch (err) {
    console.warn("[aether:stage] audio.unlock_html_audio", err);
  }
  return state;
}

/**
 * Recupera o grafo depois de o fone Bluetooth desligar a meio da sessão.
 * Tenta resume(); se continuar preso, fecha e cria outro contexto no gesto do clique.
 */
export async function resetAudioContext(): Promise<AudioContextResetResult> {
  const Ctor = audioContextCtor();
  if (!Ctor) {
    return { previous: "unsupported", current: "unsupported", action: "unsupported" };
  }

  const previous = sharedContext?.state ?? "none";
  if (sharedContext && sharedContext.state !== "closed") {
    if (isStaleContextState(sharedContext.state)) {
      try {
        await sharedContext.resume();
      } catch {
        // O close abaixo recria o grafo.
      }
      if (sharedContext.state === "running") {
        return { previous, current: sharedContext.state, action: "resumed" };
      }
    }
    try {
      await sharedContext.close();
    } catch {
      // Já a fechar.
    }
  }

  sharedContext = new Ctor();
  if (isStaleContextState(sharedContext.state)) {
    await sharedContext.resume();
  }
  return {
    previous,
    current: sharedContext.state,
    action: previous === "none" ? "created" : "recreated",
  };
}
