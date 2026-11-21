import type { ReactElement } from 'react';
import { RoleGuard } from '@/auth/role-guard';
import { AdminDashboard } from '@/dashboards/admin-dashboard';

export default function AdminScreen(): ReactElement {
  return (
    <RoleGuard allowedRole="ADMIN_BIENESTAR">
      <AdminDashboard />
    </RoleGuard>
  );
}
