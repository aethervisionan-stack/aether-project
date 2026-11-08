import { ensureAudioContextRunning } from "./diagnostics";

/** Decode base64 / remote TTS URL and play through the default output (BT headphones). */

export interface PlaybackHandle {
  stop: () => void;
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

function resolvePlayableUrl(audioUrl: string): string {
  if (/^https?:\/\//i.test(audioUrl) || audioUrl.startsWith("blob:")) {
    return audioUrl;
  }
  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  if (base) {
    return `${base}${audioUrl.startsWith("/") ? audioUrl : `/${audioUrl}`}`;
  }
  // Vite /api proxy in development
  return `/api${audioUrl.startsWith("/") ? audioUrl : `/${audioUrl}`}`;
}

/**
 * Autoplay TTS on the OS default output (Bluetooth headset when selected).
 * Prefer `audio_url` (GET /audio/{filename}); fall back to base64 bytes.
 */
export async function playResponseAudio(options: {
  audioUrl?: string | null;
  audioBase64?: string | null;
  mimeType?: string;
}): Promise<PlaybackHandle> {
  const mimeType = options.mimeType ?? "audio/mpeg";
  let objectUrl: string | null = null;
  let src: string;

  if (options.audioUrl) {
    src = resolvePlayableUrl(options.audioUrl);
  } else if (options.audioBase64) {
    const blob = base64ToBlob(options.audioBase64, mimeType);
    objectUrl = URL.createObjectURL(blob);
    src = objectUrl;
  } else {
    throw new Error("No TTS audio_url or audio_base64 to play");
  }

  console.log("[aether:stage] playback.start", {
    hasAudioUrl: !!options.audioUrl,
    hasAudioBase64: !!options.audioBase64,
    mimeType,
    srcKind: src.startsWith("blob:") ? "blob" : src.startsWith("/api") ? "proxy" : "remote",
    srcPreview: src.slice(0, 120),
  });

  const audio = new Audio(src);
  audio.preload = "auto";

  const cleanup = () => {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  };

  audio.addEventListener("ended", cleanup, { once: true });
  audio.addEventListener("error", cleanup, { once: true });

  try {
    await ensureAudioContextRunning();
  } catch (err) {
    console.warn("[aether:stage] playback.audiocontext", err);
    // O elemento <audio> ainda tenta tocar; o reset manual do HUD recupera o grafo.
  }

  try {
    await audio.play();
    console.log("[aether:stage] playback.playing");
  } catch (err) {
    console.error("[aether:stage] playback.error", err);
    if (err instanceof Error && err.stack) {
      console.error("[aether:stage] playback.error.stack", err.stack);
    }
    cleanup();
    throw err;
  }

  return {
    stop: () => {
      audio.pause();
      audio.src = "";
      cleanup();
    },
  };
}

/** @deprecated Prefer playResponseAudio — kept for callers that only have base64. */
export async function playBase64Audio(
  base64: string,
  mimeType: string,
): Promise<PlaybackHandle> {
  return playResponseAudio({ audioBase64: base64, mimeType });
}
