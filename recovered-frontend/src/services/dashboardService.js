import { supabase } from '../lib/supabase';

/**
 * Fetch offices accessible to the current user based on their role.
 * - super_admin: all active offices
 * - admin: ALL active offices (cross-office financial visibility)
 * - office_manager: their single assigned office only
 * - staff/doctor: their assigned office only
 */
export const getAccessibleOffices = async (userProfile) => {
  if (!userProfile) return [];

  // super_admin, admin, and regional roles all see ALL offices
  if (
    userProfile?.role === 'super_admin' ||
    userProfile?.role === 'admin' ||
    userProfile?.role === 'regional_manager' ||
    userProfile?.role === 'regional_clinical_manager'
  ) {
    const { data, error } = await supabase
      ?.from('offices')
      ?.select('id, name, address')
      ?.eq('is_active', true)
      ?.order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  // office_manager, staff, doctor — return their single assigned office only
  // First try profile's office_id
  if (userProfile?.office_id) {
    const { data, error } = await supabase
      ?.from('offices')
      ?.select('id, name, address')
      ?.eq('id', userProfile?.office_id)
      ?.eq('is_active', true)
      ?.single();
    if (error) return [];
    return data ? [data] : [];
  }

  // Fallback: check user_office_assignments table
  const { data: assignments } = await supabase
    ?.from('user_office_assignments')
    ?.select('office_id, offices(id, name, address)')
    ?.eq('user_id', userProfile?.id);

  if (assignments?.length > 0) {
    const officeIds = assignments?.map(a => a?.office_id)?.filter(Boolean);
    if (officeIds?.length > 0) {
      const { data: officeData } = await supabase
        ?.from('offices')
        ?.select('id, name, address')
        ?.in('id', officeIds)
        ?.eq('is_active', true)
        ?.order('name', { ascending: true });
      // For office_manager, return only first assigned office (single-office restriction)
      if (userProfile?.role === 'office_manager') {
        return officeData?.length > 0 ? [officeData?.[0]] : [];
      }
      return officeData || [];
    }
  }

  return [];
};

/**
 * Check if a user role can see cross-office comparisons.
 * Both super_admin and admin have cross-office visibility.
 */
export const canViewCrossOffice = (userProfile) => {
  return userProfile?.role === 'super_admin' || userProfile?.role === 'admin';
};

/**
 * Check if a user is an Office Manager.
 */
export const isOfficeManager = (userProfile) => {
  return userProfile?.role === 'office_manager';
};

/**
 * Check if a user can approve/reject entries.
 */
export const canApproveEntries = (userProfile) => {
  return ['super_admin', 'admin', 'office_manager']?.includes(userProfile?.role);
};

/**
 * Fetch KPI summary metrics filtered by accessible office IDs.
 */
export const getKPIMetrics = async (officeIds) => {
  if (!officeIds?.length) return null;
  // Placeholder: in a real implementation this would query financial tables
  // filtered by officeIds. Returning null signals to use fallback display.
  return null;
};

export default { getAccessibleOffices, getKPIMetrics, canViewCrossOffice, isOfficeManager, canApproveEntries };
