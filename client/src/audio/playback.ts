/** Decode base64 TTS audio and play through the default output (BT headphones). */

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

export async function playBase64Audio(
  base64: string,
  mimeType: string,
): Promise<PlaybackHandle> {
  const blob = base64ToBlob(base64, mimeType);
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.preload = "auto";

  const cleanup = () => {
    URL.revokeObjectURL(url);
  };

  audio.addEventListener("ended", cleanup, { once: true });
  audio.addEventListener("error", cleanup, { once: true });

  await audio.play();

  return {
    stop: () => {
      audio.pause();
      audio.src = "";
      cleanup();
    },
  };
}
