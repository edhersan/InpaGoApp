import type { ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider } from '@/auth/auth-context';
import { PendingSyncBanner } from '@/api/pending-sync-banner';

export default function RootLayout(): ReactElement {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <PendingSyncBanner />
          <View style={styles.container}>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#F5F7FA' },
              }}
            />
          </View>
        </SafeAreaView>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#07152F',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
});
