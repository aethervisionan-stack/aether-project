/**
 * Web Speech API fallback when MediaRecorder / getUserMedia is unavailable.
 * Used by the HUD Safe Mode path — text only, then cognitive chat / local TTS.
 */

export interface SpeechListenResult {
  transcript: string;
  durationMs: number;
  interim: string;
}

export class SpeechCaptureError extends Error {
  readonly kind: "unsupported" | "aborted" | "no_speech" | "blocked" | "unknown";

  constructor(
    kind: SpeechCaptureError["kind"],
    message: string,
  ) {
    super(message);
    this.name = "SpeechCaptureError";
    this.kind = kind;
  }
}

type RecognitionCtor = new () => SpeechRecognition;

function getSpeechRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function isSpeechRecognitionAvailable(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

export class WebSpeechCapture {
  private recognition: SpeechRecognition | null = null;
  private startedAt = 0;
  private finalBits: string[] = [];
  private interim = "";
  private listening = false;

  isListening(): boolean {
    return this.listening;
  }

  getInterim(): string {
    return this.interim;
  }

  async start(options: { lang?: string } = {}): Promise<void> {
    if (this.listening) return;
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      throw new SpeechCaptureError(
        "unsupported",
        "Web Speech API indisponível neste browser.",
      );
    }

    this.finalBits = [];
    this.interim = "";
    const recognition = new Ctor();
    recognition.lang = options.lang ?? "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    this.recognition = recognition;
    this.startedAt = performance.now();
    this.listening = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const piece = result[0]?.transcript ?? "";
        if (result.isFinal) {
          const cleaned = piece.trim();
          if (cleaned) this.finalBits.push(cleaned);
        } else {
          interim += piece;
        }
      }
      this.interim = interim.trim();
    };

    await new Promise<void>((resolve, reject) => {
      recognition.onstart = () => resolve();
      recognition.onerror = (ev: SpeechRecognitionErrorEvent) => {
        this.listening = false;
        if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
          reject(
            new SpeechCaptureError(
              "blocked",
              "Permissão de reconhecimento de voz bloqueada.",
            ),
          );
          return;
        }
        if (ev.error === "aborted") {
          reject(new SpeechCaptureError("aborted", "Reconhecimento cancelado."));
          return;
        }
        // "no-speech" can fire mid-session; keep listening until stop().
        if (ev.error === "no-speech") {
          return;
        }
        reject(
          new SpeechCaptureError(
            "unknown",
            `Web Speech erro: ${ev.error || "desconhecido"}`,
          ),
        );
      };
      try {
        recognition.start();
      } catch (err) {
        this.listening = false;
        reject(
          err instanceof SpeechCaptureError
            ? err
            : new SpeechCaptureError(
                "unknown",
                err instanceof Error ? err.message : "Falha ao iniciar Web Speech.",
              ),
        );
      }
    });
  }

  async stop(): Promise<SpeechListenResult> {
    if (!this.recognition || !this.listening) {
      throw new SpeechCaptureError("aborted", "Safe Mode não está a escutar.");
    }
    const recognition = this.recognition;
    const durationMs = Math.round(performance.now() - this.startedAt);

    const transcript = await new Promise<string>((resolve) => {
      const finish = () => {
        const text = [...this.finalBits, this.interim].join(" ").replace(/\s+/g, " ").trim();
        this.listening = false;
        this.recognition = null;
        resolve(text);
      };
      recognition.onend = () => finish();
      try {
        recognition.stop();
      } catch {
        finish();
      }
      // Safety valve if onend never fires
      window.setTimeout(finish, 1200);
    });

    if (!transcript) {
      throw new SpeechCaptureError(
        "no_speech",
        "Nenhuma fala detectada. Tente de novo perto do microfone.",
      );
    }

    return { transcript, durationMs, interim: "" };
  }

  cancel(): void {
    if (!this.recognition) {
      this.listening = false;
      return;
    }
    try {
      this.recognition.onend = null;
      this.recognition.onerror = null;
      this.recognition.onresult = null;
      this.recognition.abort();
    } catch {
      // ignore
    }
    this.recognition = null;
    this.listening = false;
    this.finalBits = [];
    this.interim = "";
  }
}

/** Local TTS when the pipeline has no audio_url (Safe Mode path). */
export function speakLocally(text: string, lang = "pt-BR"): Promise<void> {
  const cleaned = text.trim();
  if (!cleaned) return Promise.resolve();
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(cleaned);
    utter.lang = lang;
    utter.rate = 1.02;
    utter.onend = () => resolve();
    utter.onerror = () => resolve();
    window.speechSynthesis.speak(utter);
  });
}
