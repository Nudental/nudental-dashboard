import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import useRolePermissions from '../../hooks/useRolePermissions';
import { AccessDenied } from '../../hooks/useRbacGuard';
import { FrontDeskRequestReview } from '../inventory-dashboard/components/FrontDeskInventoryTab';

export default function FrontDeskApprovals() {
  const { userProfile } = useAuth();
  const { hasPermission, loading } = useRolePermissions();
  if (loading) return <div className="p-6" role="status">Checking access…</div>;
  const canReview = ['super_admin', 'admin', 'regional_manager'].includes(userProfile?.role)
    && hasPermission('workflow.approvals.view');
  if (!canReview) return <AccessDenied message="Front Desk approval requires Regional Manager or Admin access." />;
  return (
    <main className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Front Desk Approvals</h1>
        <p className="text-sm text-muted-foreground mt-1">Review supply requests from your permitted offices. You cannot approve your own request.</p>
      </header>
      <FrontDeskRequestReview />
    </main>
  );
}
