import { useEffect, useRef, type ReactElement } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

export interface AudioWaveVisualizerProps {
  isRecording: boolean;
  meteringDb?: number | null;
  barCount?: number;
}

const DEFAULT_BAR_COUNT = 18;

export function AudioWaveVisualizer({
  isRecording,
  meteringDb = null,
  barCount = DEFAULT_BAR_COUNT,
}: AudioWaveVisualizerProps): ReactElement {
  const barsRef = useRef<Animated.Value[]>(
    Array.from({ length: barCount }, () => new Animated.Value(0.2))
  );

  useEffect(() => {
    const bars = barsRef.current;

    if (!isRecording) {
      bars.forEach((value) => {
        Animated.timing(value, {
          toValue: 0.18,
          duration: 180,
          useNativeDriver: false,
        }).start();
      });
      return;
    }

    const normalizedLevel =
      typeof meteringDb === 'number'
        ? Math.min(1, Math.max(0.2, (meteringDb + 60) / 60))
        : 0.72;

    const interval = setInterval(() => {
      bars.forEach((value, index) => {
        const centerWeight = 1 - Math.abs(index - (bars.length - 1) / 2) / (bars.length / 2);
        const jitter = 0.35 + Math.random() * 0.65;
        const target = Math.min(1, Math.max(0.16, normalizedLevel * (0.45 + centerWeight * 0.55) * jitter));

        Animated.timing(value, {
          toValue: target,
          duration: 120,
          useNativeDriver: false,
        }).start();
      });
    }, 130);

    return () => {
      clearInterval(interval);
    };
  }, [isRecording, meteringDb]);

  return (
    <View accessibilityLabel="Visualizador de ondas de audio" style={styles.container}>
      {barsRef.current.map((animatedHeight, index) => {
        const barColor = index % 2 === 0 ? '#F0440B' : '#07152F';
        const height = animatedHeight.interpolate({
          inputRange: [0, 1],
          outputRange: [8, 44],
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.bar,
              {
                backgroundColor: barColor,
                height,
                opacity: isRecording ? 1 : 0.45,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bar: {
    width: 5,
    borderRadius: 999,
  },
});
