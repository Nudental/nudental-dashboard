import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOffice } from '../contexts/OfficeContext';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook that enforces office-level access control.
 * Single-office users are redirected to their own office's dashboard
 * if they attempt to access a page scoped to a different office.
 *
 * @param {string|null} requestedOfficeId - The office ID being requested (from URL params or page state)
 * @param {string} redirectPath - Where to redirect on unauthorized access (default: '/')
 */
const useOfficeGuard = (requestedOfficeId = null, redirectPath = '/') => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { selectedOfficeId, canSwitchOffice, officesLoading } = useOffice();

  useEffect(() => {
    // Wait until offices are loaded and user profile is available
    if (officesLoading || !userProfile || !selectedOfficeId) return;

    // Multi-office users (admin/super_admin) are never blocked
    if (canSwitchOffice) return;

    // If a specific office is being requested and it doesn't match the user's office
    if (requestedOfficeId && requestedOfficeId !== selectedOfficeId) {
      navigate(redirectPath, { replace: true });
    }
  }, [requestedOfficeId, selectedOfficeId, canSwitchOffice, officesLoading, userProfile, navigate, redirectPath]);

  return {
    isAuthorized: canSwitchOffice || !requestedOfficeId || requestedOfficeId === selectedOfficeId,
  };
};

export default useOfficeGuard;
