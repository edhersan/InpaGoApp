import type { ReactElement } from 'react';
import { RoleGuard } from '@/auth/role-guard';
import { TeacherDashboard } from '@/dashboards/teacher-dashboard';

export default function TeacherScreen(): ReactElement {
  return (
    <RoleGuard allowedRole="DOCENTE">
      <TeacherDashboard />
    </RoleGuard>
  );
}
