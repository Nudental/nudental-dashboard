import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import useRolePermissions from './useRolePermissions';

/**
 * Returns a goHome() function that navigates to the correct home page
 * based on the current user's role AND permissions.
 *
 * - super_admin → '/' (Executive Overview — always)
 * - regional_manager / regional_clinical_manager → '/' (Executive Overview — always)
 * - admin → '/' only if dashboard:executive_overview permission is granted; otherwise '/kpis'
 * - All other roles (office_manager, front_desk, provider, etc.) → '/daily-entry-form'
 *
 * This prevents admin users without dashboard:executive_overview from being routed
 * to a page they cannot access, which previously caused a crash.
 */
const ALWAYS_EXECUTIVE_ROLES = ['super_admin', 'regional_manager', 'regional_clinical_manager'];

export const useHomeNavigation = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { hasPermission } = useRolePermissions();

  const goHome = () => {
    const role = userProfile?.role;

    // super_admin and regional roles always land on executive overview
    if (ALWAYS_EXECUTIVE_ROLES?.includes(role)) {
      navigate('/');
      return;
    }

    // admin: only route to executive overview if they have the permission
    if (role === 'admin') {
      const canViewExecutive = hasPermission('dashboard:executive_overview');
      navigate(canViewExecutive ? '/' : '/kpis');
      return;
    }

    // All other roles → daily entry form
    navigate('/daily-entry-form');
  };

  return goHome;
};

export default useHomeNavigation;
