import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Link } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/constants/theme';
import { BACKEND_URL } from '@/lib/config';

type VadState = 'idle' | 'listening' | 'speech' | 'silence';
type Mode = 'live' | 'demo';

const VAD_SPEECH_THRESHOLD = 0.12;
const VAD_SILENCE_FRAMES = 8;

export default function CopilotScreen() {
  const insets = useSafeAreaInsets();
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  const recorderState = useAudioRecorderState(recorder, 80);
  const [permission, setPermission] = useState<boolean | null>(null);
  const [vad, setVad] = useState<VadState>('idle');
  const [mode, setMode] = useState<Mode>('live');
  const [demoLevel, setDemoLevel] = useState(0);
  const [transcript, setTranscript] = useState(
    'Toque em Ouvir para ativar o Copiloto de Voz com VAD.',
  );
  const [backendHint, setBackendHint] = useState<string | null>(null);
  const silenceFrames = useRef(0);
  const pulse = useSharedValue(1);
  const demoTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const liveMetering = useMemo(() => {
    const raw = (recorderState as { metering?: number }).metering;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
    return Math.min(1, Math.max(0, (raw + 60) / 60));
  }, [recorderState]);

  const metering = mode === 'demo' ? demoLevel : liveMetering;

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/health`);
        if (res.ok) setBackendHint(`API online · ${BACKEND_URL}`);
        else setBackendHint(`API respondeu ${res.status}`);
      } catch {
        setBackendHint(`API offline · ${BACKEND_URL}`);
      }
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (demoTimer.current) clearInterval(demoTimer.current);
    };
  }, []);

  useEffect(() => {
    if (vad === 'idle') return;
    if (mode === 'live' && !recorderState.isRecording) return;

    if (metering >= VAD_SPEECH_THRESHOLD) {
      silenceFrames.current = 0;
      setVad('speech');
      pulse.value = withSpring(1 + metering * 0.45);
      setTranscript((prev) =>
        prev.startsWith('Fala detectada')
          ? prev
          : 'Fala detectada — VAD ativo. Continue falando…',
      );
      return;
    }

    silenceFrames.current += 1;
    pulse.value = withSpring(1);
    if (silenceFrames.current >= VAD_SILENCE_FRAMES) {
      setVad('silence');
      setTranscript(
        mode === 'demo'
          ? 'Demo VAD: silêncio simulado. Aguarde o próximo pico…'
          : 'Silêncio detectado pelo VAD. Aguardando fala…',
      );
    } else if (vad !== 'listening') {
      setVad('listening');
    }
  }, [metering, recorderState.isRecording, vad, pulse, mode]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 0.55 + Math.min(0.45, (pulse.value - 1) * 2),
  }));

  const stopDemo = () => {
    if (demoTimer.current) {
      clearInterval(demoTimer.current);
      demoTimer.current = null;
    }
    setDemoLevel(0);
  };

  const startDemoVad = async () => {
    stopDemo();
    setMode('demo');
    setVad('listening');
    setTranscript(
      'Modo demo VAD (web/sem microfone): simulando níveis de áudio…',
    );
    let t = 0;
    demoTimer.current = setInterval(() => {
      t += 1;
      // Speech bursts every ~2s
      const speaking = t % 20 < 8;
      setDemoLevel(speaking ? 0.35 + Math.random() * 0.4 : Math.random() * 0.05);
    }, 100);
    try {
      await Haptics.selectionAsync();
    } catch {
      // ignore
    }
  };

  const startListening = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      setPermission(granted);
      if (!granted) {
        setTranscript('Permissão de microfone negada — iniciando demo VAD.');
        await startDemoVad();
        return;
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
      silenceFrames.current = 0;
      setMode('live');
      setVad('listening');
      setTranscript('Ouvindo… VAD monitorando o nível do microfone.');
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        // ignore
      }
    } catch (err) {
      console.warn('[Copilot] start failed', err);
      setTranscript(
        Platform.OS === 'web'
          ? 'Microfone indisponível no web — usando demo VAD.'
          : 'Não foi possível iniciar o microfone — usando demo VAD.',
      );
      await startDemoVad();
    }
  };

  const stopListening = async () => {
    stopDemo();
    try {
      if (recorderState.isRecording) {
        await recorder.stop();
      }
    } catch {
      // ignore stop errors
    }
    setVad('idle');
    setMode('live');
    pulse.value = withSpring(1);
    setTranscript('Copiloto pausado.');
    try {
      await Haptics.selectionAsync();
    } catch {
      // ignore
    }
  };

  const listening = vad !== 'idle';

  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
        },
      ]}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>Aether Vision</Text>
          <Text style={styles.title}>Copiloto de Voz</Text>
        </View>
        <Link href="/" asChild>
          <Pressable style={styles.linkChip}>
            <Text style={styles.linkChipText}>Landing</Text>
          </Pressable>
        </Link>
      </View>
      <Text style={styles.subtitle}>
        expo-audio + VAD {mode === 'demo' ? '(demo)' : '(ao vivo)'}
      </Text>

      <View style={styles.stage}>
        <Animated.View style={[styles.orb, orbStyle]} />
        <Text style={styles.vadState}>
          {vad === 'idle' && 'Pronto'}
          {vad === 'listening' && 'Ouvindo'}
          {vad === 'speech' && 'Fala'}
          {vad === 'silence' && 'Silêncio'}
        </Text>
        <Text style={styles.meter}>
          Nível: {(metering * 100).toFixed(0)}%
        </Text>
      </View>

      <Text style={styles.transcript}>{transcript}</Text>
      {permission === false ? (
        <Text style={styles.error}>
          Microfone bloqueado — demo VAD disponível.
        </Text>
      ) : null}
      {backendHint ? <Text style={styles.hint}>{backendHint}</Text> : null}

      <View style={styles.actions}>
        {!listening ? (
          <Pressable style={styles.btnPrimary} onPress={() => void startListening()}>
            <Text style={styles.btnPrimaryText}>Ouvir</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.btnStop} onPress={() => void stopListening()}>
            <Text style={styles.btnStopText}>Parar</Text>
          </Pressable>
        )}
        {!listening ? (
          <Pressable style={styles.btnGhost} onPress={() => void startDemoVad()}>
            <Text style={styles.btnGhostText}>Demo VAD</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.onyx,
    paddingHorizontal: spacing.lg,
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  brand: {
    color: colors.cyan,
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '700',
    marginTop: 4,
  },
  linkChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  linkChipText: { color: colors.muted, fontSize: 12 },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 6,
    marginBottom: spacing.lg,
  },
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  orb: {
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: colors.cyan,
  },
  vadState: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  meter: {
    color: colors.muted,
    fontFamily: 'SpaceMono',
    fontSize: 12,
  },
  transcript: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    minHeight: 66,
  },
  hint: {
    color: colors.muted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  error: {
    color: colors.violet,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
  },
  actions: { marginTop: 'auto', gap: spacing.sm },
  btnPrimary: {
    backgroundColor: colors.cyan,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnPrimaryText: { color: colors.onyx, fontWeight: '700', fontSize: 15 },
  btnStop: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnStopText: { color: colors.ink, fontWeight: '600', fontSize: 15 },
  btnGhost: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnGhostText: { color: colors.ink, fontWeight: '600', fontSize: 14 },
});
