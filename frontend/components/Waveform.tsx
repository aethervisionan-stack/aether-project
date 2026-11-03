import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { colors } from '@/constants/theme';

const BARS = [0.35, 0.7, 1, 0.55, 0.85, 0.45, 0.95, 0.6, 0.4, 0.75, 0.5, 0.9];

function Bar({ level, index }: { level: number; index: number }) {
  const height = useSharedValue(8);
  useEffect(() => {
    const target = 8 + level * 56 * (0.45 + (index % 5) * 0.12);
    height.value = withSpring(target, { damping: 14, stiffness: 180 });
  }, [level, index, height]);

  const style = useAnimatedStyle(() => ({
    height: height.value,
    opacity: 0.45 + level * 0.55,
  }));

  return <Animated.View style={[styles.bar, style]} />;
}

export function Waveform({ level }: { level: number }) {
  const clamped = Math.min(1, Math.max(0, level));
  return (
    <View style={styles.row} accessibilityLabel="Waveform">
      {BARS.map((weight, i) => (
        <Bar key={i} index={i} level={clamped * weight} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 72,
  },
  bar: {
    width: 5,
    borderRadius: 999,
    backgroundColor: colors.cyan,
    minHeight: 8,
  },
});
