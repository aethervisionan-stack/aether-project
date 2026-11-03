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
import { fetchBurnStats, fetchPrices } from '@/lib/api';

function formatNum(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

export default function BurnScreen() {
  const insets = useSafeAreaInsets();
  const burn = useQuery({ queryKey: ['burn'], queryFn: fetchBurnStats });
  const prices = useQuery({ queryKey: ['prices'], queryFn: fetchPrices });

  const events = burn.data?.recentBurns ?? [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.xl,
        },
      ]}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>Aether Vision</Text>
          <Text style={styles.title}>Burn Tracker</Text>
        </View>
        <Link href="/" asChild>
          <Pressable style={styles.linkChip}>
            <Text style={styles.linkChipText}>Landing</Text>
          </Pressable>
        </Link>
      </View>
      <Text style={styles.subtitle}>
        Buyback & burn de $VISION · demo on-chain mock
      </Text>

      <View style={styles.grid}>
        <View style={styles.stat}>
          <Text style={styles.label}>Total queimado</Text>
          {burn.isLoading ? (
            <ActivityIndicator color={colors.cyan} />
          ) : (
            <Text style={styles.value}>
              {formatNum(burn.data?.totalBurned, 0)}
            </Text>
          )}
          <Text style={styles.unit}>$VISION</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.label}>24h</Text>
          {burn.isLoading ? (
            <ActivityIndicator color={colors.cyan} />
          ) : (
            <Text style={[styles.value, { color: colors.violet }]}>
              {formatNum(burn.data?.burned24h, 0)}
            </Text>
          )}
          <Text style={styles.unit}>$VISION</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Preços (mock/demo)</Text>
        <View style={styles.priceRow}>
          <Text style={styles.priceKey}>SOL</Text>
          <Text style={styles.priceVal}>
            ${formatNum(prices.data?.solUsd ?? 150, 2)}
          </Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceKey}>$VISION</Text>
          <Text style={[styles.priceVal, { color: colors.cyan }]}>
            ${formatNum(prices.data?.visionUsd ?? 0.05, 4)}
          </Text>
        </View>
        <Text style={styles.source}>
          Fonte: {prices.data?.source ?? burn.data?.source ?? '—'}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Queimas recentes</Text>
      {burn.isLoading ? (
        <ActivityIndicator color={colors.cyan} style={{ marginTop: 12 }} />
      ) : null}
      {events.map((event) => (
        <View key={event.id} style={styles.event}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eventAmount}>
              −{formatNum(event.amount, 0)} $VISION
            </Text>
            <Text style={styles.eventMeta}>{event.note}</Text>
          </View>
          <Text style={styles.eventTime}>
            {new Date(event.ts).toLocaleDateString()}
          </Text>
        </View>
      ))}
      {burn.isError ? (
        <Text style={styles.error}>
          Não foi possível carregar o burn tracker. API offline?
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.onyx },
  content: { paddingHorizontal: spacing.lg, gap: spacing.sm },
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
    marginBottom: spacing.md,
  },
  grid: { flexDirection: 'row', gap: spacing.md },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 6,
  },
  label: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  value: {
    color: colors.ink,
    fontFamily: 'SpaceMono',
    fontSize: 22,
  },
  unit: { color: colors.muted, fontSize: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceKey: { color: colors.ink, fontSize: 15 },
  priceVal: { color: colors.ink, fontFamily: 'SpaceMono', fontSize: 16 },
  source: { color: colors.neon, fontSize: 11, marginTop: 4 },
  sectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  event: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 12,
  },
  eventAmount: { color: colors.violet, fontFamily: 'SpaceMono', fontSize: 14 },
  eventMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  eventTime: { color: colors.muted, fontSize: 11 },
  error: { color: colors.violet, fontSize: 12, marginTop: 8 },
});
