import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getAccessibleOffices } from '../services/dashboardService';

const OfficeContext = createContext({});

export const useOffice = () => {
  const context = useContext(OfficeContext);
  if (!context) {
    throw new Error('useOffice must be used within OfficeProvider');
  }
  return context;
};

export const OfficeProvider = ({ children }) => {
  const { userProfile, loading: authLoading, profileLoading } = useAuth();
  const [offices, setOffices] = useState([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState('');
  const [officesLoading, setOfficesLoading] = useState(true);
  const [officesError, setOfficesError] = useState(null);

  // Roles that can view all offices and switch between them
  const canSwitchOffice = ['super_admin', 'admin', 'regional_manager', 'regional_clinical_manager']?.includes(userProfile?.role);

  // Whether the user is restricted to a single office
  const isSingleOfficeUser = !canSwitchOffice;

  // The currently selected office object
  const selectedOffice = offices?.find(o => o?.id === selectedOfficeId) || null;

  // Display label for the current office
  const officeDisplayName = selectedOffice
    ? selectedOffice?.name
    : '';

  // Load accessible offices when user profile is ready
  const loadOffices = useCallback(async () => {
    if (authLoading || profileLoading) return;
    if (!userProfile) {
      setOffices([]);
      setSelectedOfficeId('');
      setOfficesLoading(false);
      return;
    }
    setOfficesLoading(true);
    setOfficesError(null);
    try {
      const data = await getAccessibleOffices(userProfile);
      setOffices(data || []);
      if (data?.length > 0) {
        // For single-office users: always lock to their assigned office
        // For multi-office users: prefer their profile office_id or first office
        let defaultId;
        if (isSingleOfficeUser) {
          defaultId = data?.[0]?.id;
        } else {
          defaultId = userProfile?.office_id
            ? data?.find(o => o?.id === userProfile?.office_id)?.id || data?.[0]?.id
            : data?.[0]?.id;
        }
        setSelectedOfficeId(prev => {
          // Only reset if no selection yet or if single-office user
          if (!prev || isSingleOfficeUser) return defaultId;
          // Keep existing selection if it's still in the accessible list
          const stillAccessible = data?.find(o => o?.id === prev);
          return stillAccessible ? prev : defaultId;
        });
      } else {
        setSelectedOfficeId('');
      }
    } catch (err) {
      setOfficesError(err?.message || 'Failed to load offices');
      setOffices([]);
    } finally {
      setOfficesLoading(false);
    }
  }, [userProfile, authLoading, profileLoading, isSingleOfficeUser]);

  useEffect(() => {
    loadOffices();
  }, [loadOffices]);

  // Safe office switcher — only allowed for multi-office users
  const switchOffice = useCallback((officeId) => {
    if (!canSwitchOffice) return;
    const target = offices?.find(o => o?.id === officeId);
    if (target) setSelectedOfficeId(officeId);
  }, [canSwitchOffice, offices]);

  // Check if a user is authorized to view a specific office
  const canAccessOffice = useCallback((officeId) => {
    if (canSwitchOffice) return true;
    return officeId === selectedOfficeId;
  }, [canSwitchOffice, selectedOfficeId]);

  const value = {
    offices,
    selectedOfficeId,
    selectedOffice,
    officeDisplayName,
    canSwitchOffice,
    isSingleOfficeUser,
    officesLoading,
    officesError,
    switchOffice,
    canAccessOffice,
    refreshOffices: loadOffices,
  };

  return (
    <OfficeContext.Provider value={value}>
      {children}
    </OfficeContext.Provider>
  );
};

export default OfficeContext;
