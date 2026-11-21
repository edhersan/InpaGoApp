import type { ReactElement, ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import type { RolCodigo } from '@/types/api.types';
import { getDashboardRouteForRole, useAuth } from '@/auth/auth-context';

export interface RoleGuardProps {
  allowedRole: RolCodigo;
  children: ReactNode;
}

export function RoleGuard({ allowedRole, children }: RoleGuardProps): ReactElement {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#F0440B" size="large" />
        <Text style={styles.loadingText}>Verificando sesión institucional...</Text>
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (user.rol_codigo !== allowedRole) {
    return <Redirect href={getDashboardRouteForRole(user.rol_codigo)} />;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  loadingText: {
    color: '#07152F',
    fontSize: 14,
    fontWeight: '600',
  },
});
