import type { ReactElement } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { getDashboardRouteForRole, useAuth } from '@/auth/auth-context';

export default function IndexScreen(): ReactElement {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Image source={require('../assets/logo.jpg')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brand}>
          <Text style={styles.brandNavy}>Inpa_</Text>
          <Text style={styles.brandOrange}>Go</Text>
        </Text>
        <Text style={styles.subtitle}>Fundación Universitaria UNINPAHU</Text>
        <ActivityIndicator color="#F0440B" size="large" style={styles.spinner} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return <Redirect href={getDashboardRouteForRole(user.rol_codigo)} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    width: Platform.OS === 'web' ? 260 : 225,
    height: Platform.OS === 'web' ? 173 : 150,
    borderRadius: 20,
    marginBottom: 14,
  },
  brand: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandNavy: {
    color: '#07152F',
  },
  brandOrange: {
    color: '#F0440B',
  },
  subtitle: {
    color: '#475569',
    fontSize: 13,
    marginTop: 4,
    fontWeight: '600',
  },
  spinner: {
    marginTop: 22,
  },
});
