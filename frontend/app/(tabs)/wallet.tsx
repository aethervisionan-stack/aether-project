import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/constants/theme';
import { fetchBalancesFromBackend } from '@/lib/api';
import { copyText } from '@/lib/clipboard';
import {
  getOrCreateLocalWallet,
  getSolBalance,
  getVisionBalance,
  shortenAddress,
  TREASURY_WALLET,
  VISION_MINT_ADDRESS,
} from '@/lib/solana';

function formatBalance(value: number | null | undefined, digits = 4): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const [address, setAddress] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'wallet' | 'treasury' | null>(null);
  const [source, setSource] = useState<'backend' | 'rpc' | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const keypair = await getOrCreateLocalWallet();
        if (alive) setAddress(keypair.publicKey.toBase58());
      } catch (err) {
        console.warn('[Fortaleza] wallet init failed', err);
        if (alive) {
          setInitError('Falha ao inicializar a Fortaleza Wallet neste dispositivo.');
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const balancesQuery = useQuery({
    queryKey: ['wallet-balances', address],
    enabled: Boolean(address),
    queryFn: async () => {
      if (!address) throw new Error('Sem endereço');
      try {
        const data = await fetchBalancesFromBackend(address);
        setSource('backend');
        return data;
      } catch {
        const [sol, vision] = await Promise.all([
          getSolBalance(address),
          getVisionBalance(address),
        ]);
        setSource('rpc');
        return {
          address,
          sol,
          vision,
          treasury: TREASURY_WALLET,
          mint: VISION_MINT_ADDRESS,
          source: 'rpc',
        };
      }
    },
  });

  const onRefresh = useCallback(async () => {
    try {
      await Haptics.selectionAsync();
    } catch {
      // web may not support haptics
    }
    await balancesQuery.refetch();
  }, [balancesQuery]);

  const onCopy = useCallback(async (value: string, kind: 'wallet' | 'treasury') => {
    const ok = await copyText(value);
    if (ok) {
      setCopied(kind);
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        // ignore
      }
    }
  }, []);

  const sol = balancesQuery.data?.sol ?? null;
  const vision = balancesQuery.data?.vision ?? null;
  const mint = balancesQuery.data?.mint || VISION_MINT_ADDRESS;
  const loading = !address || (balancesQuery.isLoading && sol == null);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
      ]}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>Aether Vision</Text>
          <Text style={styles.title}>Carteira Fortaleza</Text>
        </View>
        <Link href="/" asChild>
          <Pressable style={styles.linkChip}>
            <Text style={styles.linkChipText}>Landing</Text>
          </Pressable>
        </Link>
      </View>
      <Text style={styles.badge}>
        100% Auto-Custódia • Chaves no Dispositivo
      </Text>

      {initError ? <Text style={styles.error}>{initError}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.label}>Endereço local</Text>
        <Text style={styles.mono}>
          {address ? shortenAddress(address, 6) : 'Gerando carteira…'}
        </Text>
        {address ? (
          <Text style={styles.monoFull} numberOfLines={2}>
            {address}
          </Text>
        ) : null}

        <View style={styles.balances}>
          <View style={styles.balanceBlock}>
            <Text style={styles.label}>SOL</Text>
            {loading ? (
              <ActivityIndicator color={colors.cyan} />
            ) : (
              <Text style={styles.balanceValue}>{formatBalance(sol)}</Text>
            )}
          </View>
          <View style={styles.balanceBlock}>
            <Text style={styles.label}>$VISION</Text>
            {loading ? (
              <ActivityIndicator color={colors.cyan} />
            ) : (
              <Text style={[styles.balanceValue, { color: colors.cyan }]}>
                {formatBalance(vision, 2)}
              </Text>
            )}
          </View>
        </View>

        {address ? (
          <View style={styles.qrWrap}>
            <QRCode
              value={address}
              size={148}
              backgroundColor={colors.ink}
              color={colors.onyx}
            />
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            style={styles.btnGhost}
            disabled={!address}
            onPress={() => address && void onCopy(address, 'wallet')}>
            <Text style={styles.btnGhostText}>
              {copied === 'wallet' ? 'Copiado!' : 'Copiar carteira'}
            </Text>
          </Pressable>
          <Pressable
            style={styles.btnGhost}
            onPress={() => void onCopy(TREASURY_WALLET, 'treasury')}>
            <Text style={styles.btnGhostText}>
              {copied === 'treasury' ? 'Copiado!' : 'Copiar tesouraria'}
            </Text>
          </Pressable>
          <Pressable style={styles.btnPrimary} onPress={() => void onRefresh()}>
            <Text style={styles.btnPrimaryText}>
              {balancesQuery.isFetching ? 'Atualizando…' : 'Atualizar saldos'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.treasury}>
          Tesouraria: {shortenAddress(TREASURY_WALLET, 4)}
        </Text>
        <Text style={styles.treasury}>Mint: {shortenAddress(mint, 4)}</Text>
        {source ? (
          <Text style={styles.source}>
            Fonte: {source === 'backend' ? 'API local (:8000)' : 'RPC direto (fallback)'}
          </Text>
        ) : null}

        {balancesQuery.isError ? (
          <Text style={styles.error}>
            Não foi possível atualizar os saldos. Tente novamente.
          </Text>
        ) : null}
      </View>
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
  badge: {
    color: colors.cyan,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  label: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  mono: {
    color: colors.ink,
    fontFamily: 'SpaceMono',
    fontSize: 16,
  },
  monoFull: {
    color: colors.muted,
    fontFamily: 'SpaceMono',
    fontSize: 11,
  },
  balances: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  balanceBlock: { flex: 1, gap: 6 },
  balanceValue: {
    color: colors.ink,
    fontFamily: 'SpaceMono',
    fontSize: 22,
  },
  qrWrap: {
    alignSelf: 'center',
    marginVertical: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.ink,
    borderRadius: 16,
  },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  btnGhost: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnGhostText: { color: colors.ink, fontSize: 13 },
  btnPrimary: {
    backgroundColor: colors.cyan,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnPrimaryText: { color: colors.onyx, fontWeight: '700', fontSize: 13 },
  treasury: { color: colors.muted, fontSize: 12, marginTop: 2 },
  source: { color: colors.neon, fontSize: 11, marginTop: 6 },
  error: { color: colors.violet, fontSize: 12, marginTop: 4 },
});
