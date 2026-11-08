/**
 * Continuous mic capture → PCM 16-bit LE mono @ 16 kHz.
 *
 * Uses AudioContext + ScriptProcessor/AudioWorklet-free path via
 * ScriptProcessor fallback replaced by AudioWorklet is overkill for scaffold;
 * we resample with Offline-style linear interpolation from the context rate
 * down to 16 kHz so Hands-Free Bluetooth headsets stay compatible.
 */

export type PcmFrameHandler = (pcm: ArrayBuffer) => void;

const TARGET_RATE = 16_000;
const FRAME_SAMPLES = 640; // 40 ms @ 16 kHz

export class PcmCapture {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private mute: GainNode | null = null;
  private running = false;
  private resampleCarry: number[] = [];
  private onFrame: PcmFrameHandler | null = null;

  get isRunning(): boolean {
    return this.running;
  }

  async start(onFrame: PcmFrameHandler): Promise<{ label: string | null }> {
    if (this.running) {
      return { label: this.stream?.getAudioTracks()[0]?.label ?? null };
    }

    this.onFrame = onFrame;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        // Prefer 16 kHz when the browser/BT stack honors it
        sampleRate: TARGET_RATE,
      },
      video: false,
    });

    this.context = new AudioContext();
    // Some browsers ignore getUserMedia sampleRate; we always resample.
    this.source = this.context.createMediaStreamSource(this.stream);
    // 4096 buffer ≈ stable on BT hands-free links
    this.processor = this.context.createScriptProcessor(4096, 1, 1);
    this.mute = this.context.createGain();
    this.mute.gain.value = 0;

    this.processor.onaudioprocess = (event) => {
      if (!this.running || !this.onFrame) {
        return;
      }
      const input = event.inputBuffer.getChannelData(0);
      const pcm = this.resampleTo16kPcm(input, this.context!.sampleRate);
      if (pcm.byteLength > 0) {
        this.onFrame(pcm);
      }
    };

    this.source.connect(this.processor);
    this.processor.connect(this.mute);
    this.mute.connect(this.context.destination);
    this.running = true;

    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    return { label: this.stream.getAudioTracks()[0]?.label ?? null };
  }

  stop(): void {
    this.running = false;
    this.processor?.disconnect();
    this.source?.disconnect();
    this.mute?.disconnect();
    this.processor = null;
    this.source = null;
    this.mute = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.context?.close();
    this.context = null;
    this.resampleCarry = [];
    this.onFrame = null;
  }

  private resampleTo16kPcm(input: Float32Array, sourceRate: number): ArrayBuffer {
    if (sourceRate === TARGET_RATE) {
      return floatTo16BitPcm(input);
    }

    const ratio = sourceRate / TARGET_RATE;
    const merged = this.resampleCarry.length
      ? Float32Array.from([...this.resampleCarry, ...input])
      : input;

    const outLen = Math.floor(merged.length / ratio);
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i += 1) {
      const srcIndex = i * ratio;
      const i0 = Math.floor(srcIndex);
      const i1 = Math.min(i0 + 1, merged.length - 1);
      const frac = srcIndex - i0;
      out[i] = merged[i0] * (1 - frac) + merged[i1] * frac;
    }

    const consumed = outLen * ratio;
    const remainStart = Math.floor(consumed);
    this.resampleCarry = Array.from(merged.subarray(remainStart));

    // Emit in ~40 ms chunks when possible; otherwise send whatever we have.
    if (out.length >= FRAME_SAMPLES) {
      const usable = out.length - (out.length % FRAME_SAMPLES);
      const chunk = out.subarray(0, usable);
      const leftover = out.subarray(usable);
      this.resampleCarry = Array.from(leftover).concat(this.resampleCarry);
      return floatTo16BitPcm(chunk);
    }
    return floatTo16BitPcm(out);
  }
}

function floatTo16BitPcm(input: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i += 1) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}
