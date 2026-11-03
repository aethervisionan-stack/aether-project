import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/constants/theme';
import { fetchLanding } from '@/lib/api';
import { BACKEND_URL, TREASURY_PUBLIC_KEY, VISION_TOKEN_MINT } from '@/lib/config';
import { shortenAddress } from '@/lib/solana';

export default function LandingScreen() {
  const insets = useSafeAreaInsets();
  const landing = useQuery({
    queryKey: ['landing'],
    queryFn: fetchLanding,
  });

  const brand = landing.data?.brand ?? 'Aether Vision';
  const tagline =
    landing.data?.tagline ?? 'Carteira Fortaleza + Copiloto de Voz';
  const mint = landing.data?.visionTokenMint ?? VISION_TOKEN_MINT;
  const treasury = landing.data?.treasuryPublicKey ?? TREASURY_PUBLIC_KEY;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
        },
      ]}>
      <Text style={styles.brand}>{brand}</Text>
      <Text style={styles.title}>{tagline}</Text>
      <Text style={styles.subtitle}>
        {landing.data?.description ??
          'App Expo local: auto-custódia SOL/$VISION e Voice Copilot com expo-audio + VAD.'}
      </Text>

      {landing.isLoading ? (
        <ActivityIndicator color={colors.cyan} style={{ marginVertical: 24 }} />
      ) : null}
      {landing.isError ? (
        <Text style={styles.warn}>
          API offline em {BACKEND_URL}. Abrindo as telas locais mesmo assim.
        </Text>
      ) : (
        <Text style={styles.ok}>API online · {BACKEND_URL}</Text>
      )}

      <View style={styles.cards}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Carteira Fortaleza</Text>
          <Text style={styles.cardBody}>
            Saldo SOL e $VISION, QR do endereço e chaves no dispositivo.
          </Text>
          <Link href="/(tabs)/wallet" asChild>
            <Pressable style={styles.btnPrimary}>
              <Text style={styles.btnPrimaryText}>Abrir Carteira</Text>
            </Pressable>
          </Link>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Copiloto de Voz</Text>
          <Text style={styles.cardBody}>
            Escuta com expo-audio e VAD (detecção de atividade de voz).
          </Text>
          <Link href="/(tabs)/copilot" asChild>
            <Pressable style={styles.btnGhost}>
              <Text style={styles.btnGhostText}>Abrir Copiloto</Text>
            </Pressable>
          </Link>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Burn Tracker</Text>
          <Text style={styles.cardBody}>
            Buyback & burn de $VISION com preços e histórico demo.
          </Text>
          <Link href="/(tabs)/burn" asChild>
            <Pressable style={styles.btnGhost}>
              <Text style={styles.btnGhostText}>Abrir Burn</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      <View style={styles.meta}>
        <Text style={styles.metaLine}>
          Mint: {shortenAddress(mint, 4)}
        </Text>
        <Text style={styles.metaLine}>
          Tesouraria: {shortenAddress(treasury, 4)}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.onyx },
  content: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  brand: {
    color: colors.cyan,
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: '700',
    marginTop: 6,
    lineHeight: 36,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: spacing.md,
  },
  ok: { color: colors.neon, fontSize: 12, marginBottom: spacing.sm },
  warn: { color: colors.violet, fontSize: 12, marginBottom: spacing.sm },
  cards: { gap: spacing.md, marginTop: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  cardBody: { color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  btnPrimary: {
    backgroundColor: colors.cyan,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnPrimaryText: { color: colors.onyx, fontWeight: '700', fontSize: 14 },
  btnGhost: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnGhostText: { color: colors.ink, fontWeight: '600', fontSize: 14 },
  meta: { marginTop: spacing.lg, gap: 4 },
  metaLine: {
    color: colors.muted,
    fontFamily: 'SpaceMono',
    fontSize: 11,
  },
});
