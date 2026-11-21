import { useEffect, useState, type ReactElement } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { flushPendingSyncQueue, subscribePendingSync } from '@/api/client';

export function PendingSyncBanner(): ReactElement | null {
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribePendingSync((count) => {
      setPendingCount(count);
      if (count === 0) {
        setFeedback(null);
      }
    });
    return unsubscribe;
  }, []);

  if (pendingCount === 0 && !feedback) {
    return null;
  }

  const handleSync = async (): Promise<void> => {
    setSyncing(true);
    setFeedback(null);
    try {
      const result = await flushPendingSyncQueue();
      if (result.remaining === 0) {
        setFeedback(`Sincronización completada (${result.synced} operación(es) enviadas al servidor institucional).`);
      } else {
        setFeedback(
          `Se sincronizaron ${result.synced}. Quedan ${result.remaining} pendiente(s) contra el servidor institucional.`
        );
      }
    } finally {
      setSyncing(false);
    }
  };

  return (
    <View style={styles.banner}>
      <View style={styles.textColumn}>
        <Text style={styles.title}>
          {pendingCount > 0
            ? `${pendingCount} operación(es) pendientes de sincronización`
            : 'Sincronización institucional'}
        </Text>
        <Text style={styles.subtitle}>
          {feedback ?? 'Los cambios se enviarán al servidor institucional UNINPAHU al restablecer conexión.'}
        </Text>
      </View>
      {pendingCount > 0 && (
        <Pressable
          accessibilityRole="button"
          disabled={syncing}
          onPress={() => {
            void handleSync();
          }}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, syncing && styles.buttonDisabled]}
        >
          {syncing ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.buttonText}>Sincronizar</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#F0440B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: '#9A3412',
    fontSize: 13,
    fontWeight: '700',
  },
  subtitle: {
    color: '#B45309',
    fontSize: 12,
  },
  button: {
    backgroundColor: '#F0440B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 92,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
