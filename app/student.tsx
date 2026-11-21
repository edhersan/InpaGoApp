import type { ReactElement } from 'react';
import { RoleGuard } from '@/auth/role-guard';
import { StudentDashboard } from '@/dashboards/student-dashboard';

export default function StudentScreen(): ReactElement {
  return (
    <RoleGuard allowedRole="ESTUDIANTE">
      <StudentDashboard />
    </RoleGuard>
  );
}
