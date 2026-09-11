import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Breadcrumb from '../../components/layout/Breadcrumb';
import Icon from '../../components/AppIcon';
import { staffDirectoryService } from '../../services/staffDirectoryService';
import { useAuth } from '../../contexts/AuthContext';
import AddStaffModal from './components/AddStaffModal';
import EditStaffModal from './components/EditStaffModal';
import StaffPhotoUpload from './components/StaffPhotoUpload';

// ─── Helpers ────────────────────────────────────────────────────────────────

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name?.trim()?.split(/\s+/);
  if (parts?.length === 1) return parts?.[0]?.charAt(0)?.toUpperCase();
  return (parts?.[0]?.charAt(0) + parts?.[parts?.length - 1]?.charAt(0))?.toUpperCase();
};

const formatDOB = (dob) => {
  if (!dob) return '—';
  try {
    const d = new Date(dob + 'T00:00:00');
    return d?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
};

const ROLE_COLORS = {
  'Doctor/Dentist':   { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-400' },
  'Hygienist':        { bg: 'bg-teal-100 dark:bg-teal-900/30',     text: 'text-teal-700 dark:text-teal-400' },
  'Dental Assistant': { bg: 'bg-sky-100 dark:bg-sky-900/30',       text: 'text-sky-700 dark:text-sky-400' },
  'Front Office':     { bg: 'bg-amber-100 dark:bg-amber-900/30',   text: 'text-amber-700 dark:text-amber-400' },
  'Management/Admin': { bg: 'bg-rose-100 dark:bg-rose-900/30',     text: 'text-rose-700 dark:text-rose-400' },
  'Contractor':       { bg: 'bg-slate-100 dark:bg-slate-800',      text: 'text-slate-600 dark:text-slate-400' },
};

const getRoleStyle = (role) =>
  ROLE_COLORS?.[role] || { bg: 'bg-muted', text: 'text-muted-foreground' };

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
];

const getAvatarColor = (name) => {
  let hash = 0;
  for (let i = 0; i < (name?.length || 0); i++) hash = name?.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS?.[Math.abs(hash) % AVATAR_COLORS?.length];
};

const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ─── Staff Card ──────────────────────────────────────────────────────────────

const StaffCard = ({ member, photoUrl, onEdit, onPhotoClick, canManage }) => {
  const displayName = member?.directory_display_name || member?.full_name || '—';
  const altName = member?.contact_list_employee_name;
  const showAltName = altName && altName !== displayName;
  const email = member?.preferred_email || member?.work_email || member?.personal_email;
  const roleStyle = getRoleStyle(member?.role_category);
  const avatarColor = getAvatarColor(displayName);

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 hover:shadow-md hover:border-primary/30 transition-all duration-200 relative group">
      {/* Edit button (top-right, visible on hover for managers) */}
      {canManage && (
        <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(member)}
            title="Edit staff member"
            className="p-1.5 rounded-lg bg-card border border-border hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:border-amber-300 text-muted-foreground hover:text-amber-600 transition-colors"
          >
            <Icon name="Pencil" size={12} />
          </button>
        </div>
      )}

      {/* Avatar + Name */}
      <div className="flex items-start gap-3">
        {/* Photo or initials avatar */}
        <div
          className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden ${photoUrl ? '' : avatarColor} ${canManage ? 'cursor-pointer' : ''}`}
          onClick={canManage ? () => onPhotoClick(member) : undefined}
          title={canManage ? 'Click to manage photo' : undefined}
        >
          {photoUrl ? (
            <img src={photoUrl} alt={`Photo of ${displayName}`} className="w-full h-full object-cover" />
          ) : (
            getInitials(displayName)
          )}
        </div>
        <div className="min-w-0 flex-1 pr-6">
          <p className="font-semibold text-foreground text-sm leading-snug truncate">{displayName}</p>
          {showAltName && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{altName}</p>
          )}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {member?.role_category && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleStyle?.bg} ${roleStyle?.text}`}>
                {member?.role_category}
              </span>
            )}
            {member?.worker_type === 'Contractor' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                Contractor
              </span>
            )}
            <span className={`flex items-center gap-1 text-xs font-medium ${member?.is_active ? 'text-success' : 'text-muted-foreground'}`}>
              <span className={`w-1.5 h-1.5 rounded-full inline-block ${member?.is_active ? 'bg-success' : 'bg-muted-foreground'}`} />
              {member?.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-1.5 text-xs text-muted-foreground">
        {member?.job_title ? (
          <div className="flex items-center gap-2">
            <Icon name="Briefcase" size={12} className="flex-shrink-0" />
            <span className="truncate">{member?.job_title}</span>
          </div>
        ) : null}

        {member?.office_location_normalized ? (
          <div className="flex items-center gap-2">
            <Icon name="MapPin" size={12} className="flex-shrink-0" />
            <span className="truncate">{member?.office_location_normalized}</span>
          </div>
        ) : null}

        {email ? (
          <div className="flex items-center gap-2">
            <Icon name="Mail" size={12} className="flex-shrink-0" />
            <a href={`mailto:${email}`} className="truncate hover:text-foreground transition-colors" onClick={(e) => e?.stopPropagation()}>
              {email}
            </a>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Icon name="Mail" size={12} className="flex-shrink-0" />
            <span>—</span>
          </div>
        )}

        {member?.phone ? (
          <div className="flex items-center gap-2">
            <Icon name="Phone" size={12} className="flex-shrink-0" />
            <a href={`tel:${member?.phone}`} className="truncate hover:text-foreground transition-colors" onClick={(e) => e?.stopPropagation()}>
              {member?.phone}
            </a>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Icon name="Phone" size={12} className="flex-shrink-0" />
            <span>—</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Icon name="Cake" size={12} className="flex-shrink-0" />
          <span>{formatDOB(member?.date_of_birth)}</span>
        </div>
      </div>
    </div>
  );
};

// ─── Summary Card ────────────────────────────────────────────────────────────

const SummaryCard = ({ icon, label, value, color }) => (
  <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
      <Icon name={icon} size={18} />
    </div>
    <div>
      <p className="text-xl font-bold text-foreground leading-none">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  </div>
);

// ─── Empty State ─────────────────────────────────────────────────────────────

const EmptyState = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-20 gap-3">
    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
      <Icon name="Users" size={26} color="var(--color-muted-foreground)" />
    </div>
    <p className="text-base font-medium text-foreground">No staff found</p>
    <p className="text-sm text-muted-foreground text-center max-w-xs">{message}</p>
  </div>
);

// ─── Main Page ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'all',        label: 'All Staff' },
  { id: 'location',   label: 'By Location' },
  { id: 'providers',  label: 'Providers' },
  { id: 'management', label: 'Management & Admin' },
  { id: 'contractors', label: 'Contractors' },
];

const MANAGER_ROLES = ['admin', 'super_admin', 'office_manager', 'regional_clinical_manager'];

const StaffDirectory = () => {
  const { userProfile } = useAuth();
  const canManage = MANAGER_ROLES?.includes(userProfile?.role);

  const [allStaff, setAllStaff] = useState([]);
  const [locations, setLocations] = useState([]);
  const [roleCategories, setRoleCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Photo signed URLs cache: { [staffId]: signedUrl }
  const [photoUrls, setPhotoUrls] = useState({});

  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterWorkerType, setFilterWorkerType] = useState('');
  const [filterBirthdayMonth, setFilterBirthdayMonth] = useState('');
  const [filterActiveStatus, setFilterActiveStatus] = useState('active');

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [photoMember, setPhotoMember] = useState(null);
  const [photoMemberUrl, setPhotoMemberUrl] = useState(null);

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/executive-overview' },
    { label: 'Staff Directory' },
  ];

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await staffDirectoryService?.getStaff({
        search,
        officeLocation: filterLocation,
        roleCategory: filterRole,
        workerType: filterWorkerType,
        isActive: filterActiveStatus,
        birthdayMonth: filterBirthdayMonth,
      });
      setAllStaff(data || []);

      // Load signed URLs for staff with photos
      const withPhotos = (data || [])?.filter(s => s?.photo_storage_path);
      if (withPhotos?.length > 0) {
        const urlEntries = await Promise.all(
          withPhotos?.map(async (s) => {
            const url = await staffDirectoryService?.getPhotoSignedUrl(s?.photo_storage_path);
            return [s?.id, url];
          })
        );
        const urlMap = Object.fromEntries(urlEntries?.filter(([, url]) => url));
        setPhotoUrls(urlMap);
      } else {
        setPhotoUrls({});
      }
    } catch (err) {
      setError(err?.message || 'Failed to load staff directory');
    } finally {
      setLoading(false);
    }
  }, [search, filterLocation, filterRole, filterWorkerType, filterActiveStatus, filterBirthdayMonth]);

  // Load filter options once
  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [locs, roles] = await Promise.all([
          staffDirectoryService?.getLocations(),
          staffDirectoryService?.getRoleCategories(),
        ]);
        setLocations(locs || []);
        setRoleCategories(roles || []);
      } catch {}
    };
    loadMeta();
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  // Tab-filtered staff
  const tabStaff = useMemo(() => {
    switch (activeTab) {
      case 'providers':
        return allStaff?.filter(s => ['Doctor/Dentist', 'Hygienist']?.includes(s?.role_category));
      case 'management':
        return allStaff?.filter(s => s?.role_category === 'Management/Admin');
      case 'contractors':
        return allStaff?.filter(s => s?.worker_type === 'Contractor');
      default:
        return allStaff;
    }
  }, [allStaff, activeTab]);

  const grouped = useMemo(() =>
    staffDirectoryService?.groupByLocation(tabStaff),
    [tabStaff]
  );

  const summary = useMemo(() =>
    staffDirectoryService?.getSummary(allStaff),
    [allStaff]
  );

  const hasFilters = search || filterLocation || filterRole || filterWorkerType || filterBirthdayMonth || filterActiveStatus !== 'active';

  const clearFilters = () => {
    setSearch('');
    setFilterLocation('');
    setFilterRole('');
    setFilterWorkerType('');
    setFilterBirthdayMonth('');
    setFilterActiveStatus('active');
  };

  // Handlers
  const handleAddSave = async (fields) => {
    await staffDirectoryService?.createStaff(fields, userProfile?.id);
    await loadStaff();
    // Refresh locations/roles in case new ones were added
    const [locs, roles] = await Promise.all([
      staffDirectoryService?.getLocations(),
      staffDirectoryService?.getRoleCategories(),
    ]);
    setLocations(locs || []);
    setRoleCategories(roles || []);
  };

  const handleEditSave = async (id, fields) => {
    await staffDirectoryService?.updateStaff(id, fields, userProfile?.id);
    await loadStaff();
  };

  const handlePhotoClick = async (member) => {
    setPhotoMember(member);
    setPhotoMemberUrl(photoUrls?.[member?.id] || null);
  };

  const handlePhotoUpload = async (staffId, file) => {
    await staffDirectoryService?.uploadPhoto(staffId, file, userProfile?.id);
    await loadStaff();
  };

  const handlePhotoRemove = async (staffId) => {
    await staffDirectoryService?.removePhoto(staffId, userProfile?.id);
    await loadStaff();
  };

  return (
    <div className="min-h-screen bg-background">
      <Breadcrumb items={breadcrumbItems} />
      <main className="main-content">
        <div className="px-4 md:px-6 lg:px-8 py-6 md:py-8 max-w-7xl mx-auto">

          {/* Page Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between gap-3 mb-1">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon name="BookUser" size={20} color="var(--color-primary)" />
                </div>
                <h1 className="text-xl md:text-2xl font-semibold text-foreground">Staff Directory</h1>
              </div>
              {canManage && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex-shrink-0"
                >
                  <Icon name="UserPlus" size={15} />
                  <span className="hidden sm:inline">Add Staff Member</span>
                  <span className="sm:hidden">Add</span>
                </button>
              )}
            </div>
            <p className="text-sm text-muted-foreground ml-12">
              Management directory sourced from the current Gusto employee contact list.
            </p>
          </div>

          {/* Summary Cards */}
          {!loading && !error && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
              <SummaryCard icon="Users" label="Total Staff" value={summary?.total} color="bg-primary/10 text-primary" />
              <SummaryCard icon="MapPin" label="Locations" value={summary?.locations} color="bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400" />
              <SummaryCard icon="Stethoscope" label="Providers" value={summary?.providers} color="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400" />
              <SummaryCard icon="ClipboardList" label="Mgmt / Admin" value={summary?.managementAdmin} color="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400" />
              <SummaryCard icon="Wrench" label="Contractors" value={summary?.contractors} color="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" />
            </div>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 mb-5 overflow-x-auto scrollbar-none">
            {TABS?.map(tab => (
              <button
                key={tab?.id}
                onClick={() => setActiveTab(tab?.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                  activeTab === tab?.id
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab?.label}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="bg-card border border-border rounded-xl p-4 mb-6">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Icon name="Search" size={14} color="var(--color-muted-foreground)" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search name, email, phone, title..."
                    value={search}
                    onChange={(e) => setSearch(e?.target?.value)}
                    className="w-full pl-9 pr-8 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-foreground placeholder:text-muted-foreground"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <Icon name="X" size={13} />
                    </button>
                  )}
                </div>
                <select value={filterLocation} onChange={(e) => setFilterLocation(e?.target?.value)} className="px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground min-w-[150px]">
                  <option value="">All Locations</option>
                  {locations?.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                </select>
                <select value={filterRole} onChange={(e) => setFilterRole(e?.target?.value)} className="px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground min-w-[160px]">
                  <option value="">All Roles</option>
                  {roleCategories?.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 flex-wrap items-center">
                <select value={filterWorkerType} onChange={(e) => setFilterWorkerType(e?.target?.value)} className="px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground min-w-[140px]">
                  <option value="">All Worker Types</option>
                  <option value="Employee">Employee</option>
                  <option value="Contractor">Contractor</option>
                </select>
                <select value={filterBirthdayMonth} onChange={(e) => setFilterBirthdayMonth(e?.target?.value)} className="px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground min-w-[150px]">
                  <option value="">All Birthdays</option>
                  {MONTHS?.slice(1)?.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
                <select value={filterActiveStatus} onChange={(e) => setFilterActiveStatus(e?.target?.value)} className="px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground min-w-[130px]">
                  <option value="active">Active Only</option>
                  <option value="all">All (incl. Inactive)</option>
                  <option value="inactive">Inactive Only</option>
                </select>
                {hasFilters && (
                  <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted/50 transition-colors">
                    <Icon name="X" size={12} />
                    Clear filters
                  </button>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {loading ? 'Loading…' : `${tabStaff?.length} ${tabStaff?.length === 1 ? 'person' : 'people'}`}
                </span>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <Icon name="AlertCircle" size={15} color="var(--color-destructive)" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm">Loading staff directory…</span>
            </div>
          )}

          {/* Empty */}
          {!loading && tabStaff?.length === 0 && (
            <EmptyState
              message={
                hasFilters
                  ? 'No staff match your current filters. Try adjusting your search or filter criteria.' :'No staff records found in the directory.'
              }
            />
          )}

          {/* Content: By Location tab */}
          {!loading && activeTab === 'location' && tabStaff?.length > 0 && (
            <div className="space-y-8">
              {grouped?.map(group => (
                <section key={group?.location}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon name="Building2" size={15} color="var(--color-primary)" />
                    </div>
                    <h2 className="text-sm font-semibold text-foreground">{group?.location}</h2>
                    <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 bg-primary/10 text-primary text-xs font-semibold rounded-full">
                      {group?.staff?.length}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {group?.staff?.map(member => (
                      <StaffCard
                        key={member?.id}
                        member={member}
                        photoUrl={photoUrls?.[member?.id] || null}
                        onEdit={setEditMember}
                        onPhotoClick={handlePhotoClick}
                        canManage={canManage}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {/* Content: All other tabs (flat grid) */}
          {!loading && activeTab !== 'location' && tabStaff?.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {tabStaff?.map(member => (
                <StaffCard
                  key={member?.id}
                  member={member}
                  photoUrl={photoUrls?.[member?.id] || null}
                  onEdit={setEditMember}
                  onPhotoClick={handlePhotoClick}
                  canManage={canManage}
                />
              ))}
            </div>
          )}

        </div>
      </main>

      {/* Modals */}
      {showAddModal && (
        <AddStaffModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddSave}
        />
      )}

      {editMember && (
        <EditStaffModal
          member={editMember}
          onClose={() => setEditMember(null)}
          onSave={handleEditSave}
        />
      )}

      {photoMember && (
        <StaffPhotoUpload
          staffId={photoMember?.id}
          currentPhotoUrl={photoMemberUrl}
          hasPhoto={!!photoMember?.photo_storage_path}
          onUpload={handlePhotoUpload}
          onRemove={handlePhotoRemove}
          onClose={() => { setPhotoMember(null); setPhotoMemberUrl(null); }}
        />
      )}
    </div>
  );
};

export default StaffDirectory;
