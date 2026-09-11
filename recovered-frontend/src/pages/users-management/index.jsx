import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import UserFilters from './components/UserFilters';
import BulkActionsBar from './components/BulkActionsBar';
import UserTable from './components/UserTable';
import InviteUserModal from './components/InviteUserModal';
import EditUserModal from './components/EditUserModal';
import RoleEditorModal from '../management/RoleEditorModal';
import { usersService, officesService } from '../../services/managementService';
import { userOfficeService, emailService } from '../../services/emailService';
import { supabase } from '../../lib/supabase';
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription';
import useRolePermissions from '../../hooks/useRolePermissions';
import { AccessDenied } from '../../hooks/useRbacGuard';

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

// ─── Page-level error boundary ────────────────────────────────────────────
class UsersManagementErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error?.message || 'Unknown error' };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[UsersManagement] Render error:', error, errorInfo);
  }

  render() {
    if (this.state?.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-card border border-destructive/20 rounded-xl p-8 text-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <Icon name="AlertTriangle" size={24} color="var(--color-destructive)" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">Users Management Error</h2>
            <p className="text-sm text-muted-foreground mb-4">
              The Users Management page encountered an error while loading. This may be due to a permissions issue or a temporary problem.
            </p>
            {this.state?.errorMessage && (
              <p className="text-xs font-mono bg-muted rounded p-2 text-muted-foreground mb-4 text-left break-all">
                {this.state?.errorMessage}
              </p>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => this.setState({ hasError: false, errorMessage: '' })}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors text-foreground"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props?.children;
  }
}

// ─── Main page component ──────────────────────────────────────────────────
const UsersManagementPage = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const { hasPermission, loading: permLoading } = useRolePermissions();
  const [users, setUsers] = useState([]);
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tableFlash, setTableFlash] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [officeFilter, setOfficeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Sorting
  const [sortField, setSortField] = useState('full_name');
  const [sortDir, setSortDir] = useState('asc');

  // Selection
  const [selectedIds, setSelectedIds] = useState([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Modals
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [roleEditorOpen, setRoleEditorOpen] = useState(false);

  // Action loading
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isAdmin = userProfile?.role === 'admin' || isSuperAdmin;
  const canManageAll = isSuperAdmin || isAdmin;

  // Page-level guard
  if (!permLoading && userProfile && !isAdmin && !hasPermission('admin.users.view')) {
    return <AccessDenied message="Users Management is restricted to administrators." />;
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Load offices
      let offData = [];
      try {
        offData = (await officesService?.getAll()) || [];
      } catch (offErr) {
        console.warn('[UsersManagement] Failed to load offices:', offErr?.message);
      }
      setOffices(offData);

      // Fetch users with office assignments
      let query = supabase
        ?.from('user_profiles')
        ?.select('*')
        ?.order('full_name', { ascending: true });

      if (!query) {
        setUsers([]);
        setLoading(false);
        return;
      }

      // Admins only see users from their assigned offices
      if (!isSuperAdmin && userProfile?.id) {
        try {
          const { data: myAssignments } = await supabase
            ?.from('user_office_assignments')
            ?.select('office_id, all_offices')
            ?.eq('user_id', userProfile?.id);
          const hasAllOffices = (myAssignments || [])?.some(a => a?.all_offices);
          if (!hasAllOffices) {
            const myOfficeIds = (myAssignments || [])?.map(a => a?.office_id)?.filter(Boolean);
            if (myOfficeIds?.length > 0) {
              const { data: officeUserIds } = await supabase
                ?.from('user_office_assignments')
                ?.select('user_id')
                ?.in('office_id', myOfficeIds);
              const userIds = [...new Set((officeUserIds || [])?.map(r => r?.user_id)?.filter(Boolean))];
              if (userIds?.length > 0) {
                query = query?.in('id', userIds);
              } else {
                setUsers([]);
                setLoading(false);
                return;
              }
            }
          }
        } catch (assignErr) {
          console.warn('[UsersManagement] Failed to load office assignments:', assignErr?.message);
          // Continue without office filter — show all users the RLS allows
        }
      }

      const { data: userData, error: userError } = await query;
      if (userError) {
        console.error('[UsersManagement] Query error:', userError);
        throw new Error(userError?.message || 'Failed to load users. You may not have permission to view this page.');
      }

      // Fetch all office assignments for these users
      const userIds = (userData || [])?.map(u => u?.id)?.filter(Boolean);
      let assignments = [];
      if (userIds?.length > 0) {
        try {
          const { data: assignData } = await supabase
            ?.from('user_office_assignments')
            ?.select('*, offices(id, name)')
            ?.in('user_id', userIds);
          assignments = assignData || [];
        } catch (assignErr) {
          console.warn('[UsersManagement] Failed to load user office assignments:', assignErr?.message);
        }
      }

      // Enrich users with office data
      const enriched = (userData || [])?.map(u => {
        try {
          // admin and super_admin always have All Offices access by role
          const isAdminRole = u?.role === 'admin' || u?.role === 'super_admin';
          const userAssignments = assignments?.filter(a => a?.user_id === u?.id) || [];
          const hasAllOffices = isAdminRole || userAssignments?.some(a => a?.all_offices);
          const assignedOfficeNames = hasAllOffices
            ? 'All Offices'
            : userAssignments?.map(a => a?.offices?.name)?.filter(Boolean)?.join(', ') || '';
          return {
            ...u,
            officeAssignments: userAssignments,
            hasAllOffices,
            assignedOfficeNames,
          };
        } catch (enrichErr) {
          console.warn('[UsersManagement] Failed to enrich user:', u?.id, enrichErr?.message);
          return {
            ...u,
            officeAssignments: [],
            hasAllOffices: false,
            assignedOfficeNames: '',
          };
        }
      });

      setUsers(enriched);
    } catch (err) {
      console.error('[UsersManagement] loadData error:', err);
      setError(err?.message || 'Failed to load users. Please check your permissions and try again.');
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, userProfile?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Real-time subscriptions for user table
  const { isPulsing } = useRealtimeSubscription(
    [
      { table: 'user_profiles', events: ['INSERT', 'UPDATE', 'DELETE'] },
      { table: 'user_office_assignments', events: ['INSERT', 'UPDATE', 'DELETE'] },
    ],
    useCallback(() => {
      loadData();
      setTableFlash(true);
      setTimeout(() => setTableFlash(false), 1500);
    }, [loadData]),
    isAdmin
  );

  // Filter + Sort — defensive with try/catch to prevent render crashes
  const filteredUsers = React.useMemo(() => {
    try {
      return (users || [])
        ?.filter(u => {
          if (!u) return false;
          if (searchQuery) {
            const q = searchQuery?.toLowerCase() || '';
            const nameMatch = u?.full_name?.toLowerCase()?.includes(q);
            const emailMatch = u?.email?.toLowerCase()?.includes(q);
            const usernameMatch = u?.username?.toLowerCase()?.includes(q);
            const phoneMatch = u?.phone ? u?.phone?.replace(/\D/g, '')?.includes(q?.replace(/\D/g, '')) || u?.phone?.toLowerCase()?.includes(q) : false;
            if (!nameMatch && !emailMatch && !usernameMatch && !phoneMatch) return false;
          }
          if (roleFilter && u?.role !== roleFilter) return false;
          if (statusFilter && u?.status !== statusFilter) return false;
          if (officeFilter) {
            if (u?.hasAllOffices) return true;
            const officeIds = (u?.officeAssignments || [])?.map(a => a?.office_id)?.filter(Boolean);
            if (!officeIds?.includes(officeFilter)) return false;
          }
          return true;
        })
        ?.sort((a, b) => {
          const aVal = a?.[sortField] || '';
          const bVal = b?.[sortField] || '';
          const cmp = String(aVal)?.localeCompare(String(bVal));
          return sortDir === 'asc' ? cmp : -cmp;
        });
    } catch (filterErr) {
      console.warn('[UsersManagement] Filter error:', filterErr?.message);
      return users || [];
    }
  }, [users, searchQuery, roleFilter, statusFilter, officeFilter, sortField, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil((filteredUsers?.length || 0) / rowsPerPage));
  const paginatedUsers = filteredUsers?.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage) || [];

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, roleFilter, officeFilter, statusFilter, rowsPerPage]);

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleSelectAll = (checked) => {
    setSelectedIds(checked ? (paginatedUsers || [])?.map(u => u?.id)?.filter(Boolean) : []);
  };

  const handleSelectRow = (id, checked) => {
    setSelectedIds(prev => checked ? [...(prev || []), id] : (prev || [])?.filter(i => i !== id));
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Single user actions
  const handleToggleActive = async (id, isActive) => {
    setActionLoadingId(id);
    setError('');
    try {
      await usersService?.toggleActive(id, isActive);
      await loadData();
      showSuccess(`User ${isActive ? 'activated' : 'deactivated'} successfully`);
    } catch (err) {
      setError(err?.message || 'Failed to update status. You may not have permission to perform this action.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleApprove = async (id) => {
    setActionLoadingId(id);
    setError('');
    try {
      await usersService?.approveUser(id);
      await loadData();
      showSuccess('User approved successfully');
    } catch (err) {
      setError(err?.message || 'Failed to approve user. You may not have permission to perform this action.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeactivate = async (id) => {
    setActionLoadingId(id);
    setError('');
    try {
      await usersService?.deactivateUser(id);
      await loadData();
      showSuccess('User deactivated successfully');
    } catch (err) {
      setError(err?.message || 'Failed to deactivate user. You may not have permission to perform this action.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Invite user
  const handleInviteSubmit = async (values) => {
    setSaving(true);
    setError('');
    try {
      const newUser = await usersService?.invite({
        email: values?.email,
        fullName: values?.fullName,
        role: values?.role,
        username: values?.username,
        tempPassword: values?.tempPassword,
        phone: values?.phone,
      });
      if (newUser?.id) {
        await userOfficeService?.setUserOfficeAssignments(
          newUser?.id,
          values?.selectedOfficeIds || [],
          values?.allOffices || false
        );
        const officeName = values?.allOffices
          ? 'All Offices'
          : (offices || [])?.filter(o => (values?.selectedOfficeIds || [])?.includes(o?.id))?.map(o => o?.name)?.join(', ');
        try {
          await emailService?.sendWelcomeEmail({
            email: values?.email,
            full_name: values?.fullName,
            role: values?.role,
            office_name: officeName,
          });
        } catch (emailErr) {
          console.warn('[UsersManagement] Welcome email failed:', emailErr?.message);
        }
      }
      setInviteModalOpen(false);
      await loadData();
      showSuccess('User created successfully. They can now log in with their username and temporary password.');
    } catch (err) {
      setError(err?.message || 'Failed to create user. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Edit user
  const handleEditSubmit = async (values) => {
    if (!editUser) return;
    setSaving(true);
    setError('');
    try {
      // ── Photo handling ──────────────────────────────────────────────────
      let profilePhotoUrl = editUser?.profile_photo_url ?? null;

      if (values?.photoChange) {
        const { newPath, oldPath, action } = values?.photoChange;

        if (action === 'PHOTO_REMOVE' || action === 'PHOTO_REPLACE') {
          // Safely delete old storage object only if it belongs to this user
          if (oldPath && !oldPath?.startsWith('http') && oldPath?.split('/')?.[0] === editUser?.id) {
            try {
              await supabase?.storage?.from('profile-photos')?.remove([oldPath]);
            } catch (delErr) {
              console.warn('[UsersManagement] Failed to delete old photo from storage:', delErr?.message);
            }
          }
        }

        if (action === 'PHOTO_REMOVE') {
          profilePhotoUrl = null;
        } else if (newPath) {
          // newPath is already uploaded in the modal; just record the storage key
          profilePhotoUrl = newPath;
        }

        // Write audit log for photo action
        try {
          const { data: { user: authUser } } = await supabase?.auth?.getUser();
          if (authUser) {
            const summaryMap = {
              PHOTO_UPLOAD: `Uploaded profile photo for ${editUser?.full_name || editUser?.id}`,
              PHOTO_REPLACE: `Replaced profile photo for ${editUser?.full_name || editUser?.id}`,
              PHOTO_REMOVE: `Removed profile photo for ${editUser?.full_name || editUser?.id}`,
            };
            await supabase?.from('audit_logs')?.insert({
              user_id: authUser?.id,
              action,
              table_name: 'user_profiles',
              record_id: editUser?.id,
              old_values: oldPath ? { profile_photo_url: oldPath } : null,
              new_values: newPath ? { profile_photo_url: newPath } : null,
              change_summary: summaryMap?.[action] || `Photo action ${action} for ${editUser?.full_name || editUser?.id}`,
            });
          }
        } catch (auditErr) {
          console.warn('[UsersManagement] Photo audit log error:', auditErr?.message);
        }
      }

      // ── Core user profile update ────────────────────────────────────────
      await usersService?.update(editUser?.id, {
        full_name: values?.full_name,
        role: values?.role,
        status: values?.status,
        is_active: values?.status === 'Active',
        is_approved: values?.status === 'Active',
        phone: values?.phone?.trim() || null,
        username: values?.username?.trim()?.toLowerCase() || null,
        profile_photo_url: profilePhotoUrl,
      });
      await userOfficeService?.setUserOfficeAssignments(
        editUser?.id,
        values?.selectedOfficeIds || [],
        values?.allOffices || false
      );
      setEditUser(null);
      await loadData();
      showSuccess('User updated successfully');
    } catch (err) {
      setError(err?.message || 'Failed to update user. You may not have permission to perform this action.');
    } finally {
      setSaving(false);
    }
  };

  // Bulk actions
  const handleBulkActivate = async () => {
    setSaving(true);
    setError('');
    try {
      await Promise.all((selectedIds || [])?.map(id => usersService?.approveUser(id)));
      setSelectedIds([]);
      await loadData();
      showSuccess(`${selectedIds?.length} users activated`);
    } catch (err) {
      setError(err?.message || 'Bulk activate failed');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkDeactivate = async () => {
    setSaving(true);
    setError('');
    try {
      await Promise.all((selectedIds || [])?.map(id => usersService?.deactivateUser(id)));
      setSelectedIds([]);
      await loadData();
      showSuccess(`${selectedIds?.length} users deactivated`);
    } catch (err) {
      setError(err?.message || 'Bulk deactivate failed');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkRoleChange = async (role) => {
    setSaving(true);
    setError('');
    try {
      await Promise.all((selectedIds || [])?.map(id => usersService?.update(id, { role })));
      setSelectedIds([]);
      await loadData();
      showSuccess(`Role updated for ${selectedIds?.length} users`);
    } catch (err) {
      setError(err?.message || 'Bulk role change failed');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkOfficeAssign = async (officeIds, allOfficesFlag) => {
    setSaving(true);
    setError('');
    try {
      await Promise.all((selectedIds || [])?.map(id => userOfficeService?.setUserOfficeAssignments(id, officeIds, allOfficesFlag)));
      setSelectedIds([]);
      await loadData();
      showSuccess(`Office assignment updated for ${selectedIds?.length} users`);
    } catch (err) {
      setError(err?.message || 'Bulk office assign failed');
    } finally {
      setSaving(false);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setRoleFilter('');
    setOfficeFilter('');
    setStatusFilter('');
  };

  const activeCount = (users || [])?.filter(u => u?.status === 'Active')?.length || 0;
  const notActivatedCount = (users || [])?.filter(u => u?.status === 'Pending' || u?.status === 'Inactive')?.length || 0;
  const deactivatedCount = (users || [])?.filter(u => u?.status === 'Deactivated')?.length || 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Page Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              <Icon name="ChevronLeft" size={16} />
              Back to Home
            </button>
            <h1 className="text-2xl font-bold text-foreground">User Management</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {loading ? 'Loading...' : `${(users || [])?.length} total users · ${activeCount} active · ${notActivatedCount} not activated · ${deactivatedCount} deactivated`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isSuperAdmin && (
              <Button
                variant="outline"
                onClick={() => setRoleEditorOpen(true)}
                className="flex items-center gap-2"
              >
                <Icon name="ShieldCog" size={15} />
                Role Editor
              </Button>
            )}
            {isAdmin && (
              <Button
                variant="default"
                onClick={() => setInviteModalOpen(true)}
                className="flex items-center gap-2"
              >
                <Icon name="UserPlus" size={15} />
                Invite New User
              </Button>
            )}
          </div>
        </div>

        {/* Success Message */}
        {successMsg && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-success/10 border border-success/20 rounded-lg">
            <Icon name="CheckCircle" size={15} color="var(--color-success)" />
            <p className="text-sm text-success font-medium">{successMsg}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <Icon name="AlertCircle" size={15} color="var(--color-destructive)" />
            <p className="text-sm text-destructive flex-1">{error}</p>
            <button onClick={() => setError('')} className="ml-auto text-destructive hover:text-destructive/80 flex-shrink-0">
              <Icon name="X" size={14} />
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="mb-4">
          <UserFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            roleFilter={roleFilter}
            onRoleChange={setRoleFilter}
            officeFilter={officeFilter}
            onOfficeChange={setOfficeFilter}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            offices={offices || []}
            onClearAll={handleClearFilters}
          />
        </div>

        {/* Bulk Actions Bar */}
        <BulkActionsBar
          selectedCount={(selectedIds || [])?.length}
          offices={offices || []}
          onBulkActivate={handleBulkActivate}
          onBulkDeactivate={handleBulkDeactivate}
          onBulkRoleChange={handleBulkRoleChange}
          onBulkOfficeAssign={handleBulkOfficeAssign}
          onClearSelection={() => setSelectedIds([])}
        />

        {/* Table Card */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <UserTable
            users={paginatedUsers}
            loading={loading}
            selectedIds={selectedIds || []}
            onSelectAll={handleSelectAll}
            onSelectRow={handleSelectRow}
            onEdit={setEditUser}
            onApprove={handleApprove}
            onDeactivate={handleDeactivate}
            onToggleActive={handleToggleActive}
            actionLoadingId={actionLoadingId}
            sortField={sortField}
            sortDir={sortDir}
            onSort={handleSort}
            canManageAll={canManageAll}
          />

          {/* Pagination */}
          {!loading && (filteredUsers?.length || 0) > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 border-t border-border bg-muted/20">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rows per page:</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => setRowsPerPage(Number(e?.target?.value))}
                  className="px-2 py-1 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
                >
                  {ROWS_PER_PAGE_OPTIONS?.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground mr-2">
                  {(currentPage - 1) * rowsPerPage + 1}–{Math.min(currentPage * rowsPerPage, filteredUsers?.length || 0)} of {filteredUsers?.length || 0}
                </span>
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Icon name="ChevronsLeft" size={15} />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Icon name="ChevronLeft" size={15} />
                </button>
                <span className="px-3 py-1 text-sm font-medium text-foreground">{currentPage} / {totalPages}</span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Icon name="ChevronRight" size={15} />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Icon name="ChevronsRight" size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <InviteUserModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        offices={offices || []}
        onSubmit={handleInviteSubmit}
        loading={saving}
      />

      <EditUserModal
        isOpen={!!editUser}
        onClose={() => setEditUser(null)}
        user={editUser}
        offices={offices || []}
        onSubmit={handleEditSubmit}
        loading={saving}
        canManagePhoto={isAdmin}
      />

      {isSuperAdmin && (
        <RoleEditorModal
          isOpen={roleEditorOpen}
          onClose={() => setRoleEditorOpen(false)}
        />
      )}
    </div>
  );
};

// ─── Wrapped export with page-level error boundary ────────────────────────
const UsersManagementPageWithBoundary = () => (
  <UsersManagementErrorBoundary>
    <UsersManagementPage />
  </UsersManagementErrorBoundary>
);

export default UsersManagementPageWithBoundary;
