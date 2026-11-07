/**
 * Microphone capture aimed at generic Bluetooth headsets.
 * Uses the browser MediaRecorder API — pair the headset at OS level first.
 */

export type CaptureState = "idle" | "requesting" | "recording" | "stopping" | "error";

export interface CaptureResult {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

export interface HeadsetCaptureOptions {
  /** Prefer these MIME types when the browser supports them. */
  preferredMimeTypes?: string[];
  audioBitsPerSecond?: number;
}

const DEFAULT_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function pickMimeType(candidates: string[]): string {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return "";
}

export class HeadsetCapture {
  private mediaStream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private startedAt = 0;
  private state: CaptureState = "idle";

  constructor(private readonly options: HeadsetCaptureOptions = {}) {}

  getState(): CaptureState {
    return this.state;
  }

  async start(): Promise<void> {
    if (this.state === "recording") {
      return;
    }
    this.state = "requesting";
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
        video: false,
      });
    } catch (err) {
      this.state = "error";
      throw err;
    }

    const mimeType = pickMimeType(
      this.options.preferredMimeTypes ?? DEFAULT_MIME_CANDIDATES,
    );
    this.chunks = [];
    this.recorder = new MediaRecorder(
      this.mediaStream,
      mimeType
        ? {
            mimeType,
            audioBitsPerSecond: this.options.audioBitsPerSecond ?? 128_000,
          }
        : { audioBitsPerSecond: this.options.audioBitsPerSecond ?? 128_000 },
    );
    this.recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };
    this.startedAt = performance.now();
    this.recorder.start(100);
    this.state = "recording";
  }

  async stop(): Promise<CaptureResult> {
    if (!this.recorder || this.state !== "recording") {
      throw new Error("Captura não está ativa");
    }
    this.state = "stopping";
    const recorder = this.recorder;
    const mimeType = recorder.mimeType || "audio/webm";

    const blob = await new Promise<Blob>((resolve, reject) => {
      recorder.onerror = () => reject(new Error("MediaRecorder error"));
      recorder.onstop = () => {
        resolve(new Blob(this.chunks, { type: mimeType }));
      };
      recorder.stop();
    });

    this.teardownStream();
    this.state = "idle";
    return {
      blob,
      mimeType,
      durationMs: Math.round(performance.now() - this.startedAt),
    };
  }

  cancel(): void {
    if (this.recorder && this.state === "recording") {
      try {
        this.recorder.stop();
      } catch {
        // ignore
      }
    }
    this.teardownStream();
    this.chunks = [];
    this.state = "idle";
  }

  private teardownStream(): void {
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = null;
    this.recorder = null;
  }
}

/** List audio input devices (after permission) so the user can confirm the BT mic. */
export async function listAudioInputs(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === "audioinput");
}
