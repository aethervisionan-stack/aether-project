/**
 * Client-side avatar image helpers: validate, resize, and compress for local ranking.
 * Output is a small data URL (~160–200px) suitable for localStorage / future remote upload.
 */

export const AVATAR_TARGET_SIZE = 180;
export const AVATAR_MAX_INPUT_BYTES = 5 * 1024 * 1024;

const ACCEPTED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const ACCEPTED_EXT = /\.(jpe?g|png|webp)$/i;

export type AvatarProcessResult =
  | { ok: true; dataUrl: string }
  | { ok: false; error: string };

export function isAcceptedAvatarFile(file: File): boolean {
  const mime = (file.type || "").toLowerCase();
  if (mime && ACCEPTED_MIME.has(mime)) return true;
  if (!mime && ACCEPTED_EXT.test(file.name)) return true;
  return false;
}

export function validateAvatarFile(file: File): string | null {
  if (!isAcceptedAvatarFile(file)) {
    return "Formato não suportado. Use JPG, PNG ou WebP.";
  }
  if (file.size <= 0) {
    return "Arquivo de imagem vazio. Escolha outra foto.";
  }
  if (file.size > AVATAR_MAX_INPUT_BYTES) {
    return "Imagem muito grande (máx. 5 MB). Escolha um arquivo menor.";
  }
  return null;
}

/** Initials for fallback avatar (1–2 letters). */
export function participantInitials(name: string): string {
  const cleaned = name.trim().replace(/\s+/g, " ");
  if (!cleaned) return "?";
  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode"));
    };
    img.src = url;
  });
}

function canvasSupportsWebp(canvas: HTMLCanvasElement): boolean {
  try {
    return canvas.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
}

/**
 * Resize to a square ~180px and compress as WebP (fallback JPEG).
 * Draws cover-cropped into a circle-friendly square canvas.
 */
export async function processAvatarFile(
  file: File,
): Promise<AvatarProcessResult> {
  const validationError = validateAvatarFile(file);
  if (validationError) return { ok: false, error: validationError };

  let img: HTMLImageElement;
  try {
    img = await loadImageFromFile(file);
  } catch {
    return {
      ok: false,
      error: "Não foi possível ler a imagem. Tente outro arquivo JPG, PNG ou WebP.",
    };
  }

  if (!img.naturalWidth || !img.naturalHeight) {
    return {
      ok: false,
      error: "Imagem inválida ou corrompida. Escolha outra foto.",
    };
  }

  const size = AVATAR_TARGET_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      ok: false,
      error: "Seu navegador não permite processar a foto localmente.",
    };
  }

  const srcSize = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - srcSize) / 2;
  const sy = (img.naturalHeight - srcSize) / 2;
  ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, size, size);

  try {
    const useWebp = canvasSupportsWebp(canvas);
    const mime = useWebp ? "image/webp" : "image/jpeg";
    const quality = useWebp ? 0.82 : 0.85;
    const dataUrl = canvas.toDataURL(mime, quality);
    if (!dataUrl.startsWith("data:image/")) {
      return {
        ok: false,
        error: "Falha ao compactar a foto. Tente novamente.",
      };
    }
    // Guard against absurd payloads for localStorage
    if (dataUrl.length > 350_000) {
      const tighter = canvas.toDataURL("image/jpeg", 0.7);
      if (tighter.length > 350_000) {
        return {
          ok: false,
          error: "A foto ficou grande demais após o processamento. Tente outra imagem.",
        };
      }
      return { ok: true, dataUrl: tighter };
    }
    return { ok: true, dataUrl };
  } catch {
    return {
      ok: false,
      error: "Falha ao processar a foto. Tente um JPG ou PNG menor.",
    };
  }
}

export function isDataUrlAvatar(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value.startsWith("data:image/") &&
    value.length > 32 &&
    value.length < 500_000
  );
}
