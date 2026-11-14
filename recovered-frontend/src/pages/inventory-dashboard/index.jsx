import HistoricalUsageReview from './components/HistoricalUsageReview';
import UsageAllocation,{canViewAllocation} from './components/UsageAllocation';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { offlineQueueService } from '../../services/offlineQueueService';
import useRolePermissions from '../../hooks/useRolePermissions';
import { useNavigate } from 'react-router-dom';
import { AccessDenied } from '../../hooks/useRbacGuard';

// Consolidated Implant & Grafting tab
import ImplantGraftingTab from './components/ImplantGraftingTab';

// Supply / Front Desk tabs
import MonthlySupplyModule from './components/MonthlySupplyModule';
import FrontDeskInventoryTab from './components/FrontDeskInventoryTab';
import PurchasingRecords from '../purchasing-records';


// ── Workflow Guide (collapsible panel content) ───────────────────────────────
const WorkflowGuidePanel = ({ onTabChange }) => {
  const cards = [
    {
      section: 'Request Supplies',
      color: 'blue',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      borderColor: 'border-blue-200',
      bgColor: 'bg-blue-50',
      items: [
        {
          icon: 'ClipboardList',
          title: 'Submit and track supply requests',
          desc: 'Request Amazon items, dental supplies, endo files or toothbrushes for an office.',
          routing: 'Caitlin · Ny · Maia',
          routingColor: 'text-blue-700 bg-blue-100',
          tab: 'request-supplies',
          btnLabel: 'Request Supplies',
          btnColor: 'bg-blue-600 hover:bg-blue-700',
        },
      ],
    },
    {
      section: 'High-Ticket Tracking',
      color: 'amber',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      borderColor: 'border-amber-200',
      bgColor: 'bg-amber-50',
      items: [
        {
          icon: 'ScanLine',
          title: 'Bone / Tissue / Membrane — Scan In (Receive)',
          desc: 'Scan item when it arrives at the office. Records: item type, barcode/lot/serial, expiration date, office location, quantity, staff member, received date/time, vendor/source.',
          routing: 'Step 1 of 2 — Receiving',
          routingColor: 'text-amber-700 bg-amber-100',
          tab: 'implant-grafting',
          btnLabel: 'Implant & Grafting → Bone/Tissue',
          btnColor: 'bg-emerald-600 hover:bg-emerald-700',
        },
        {
          icon: 'PackageMinus',
          title: 'Bone / Tissue / Membrane — Scan Out (Consume)',
          desc: 'Scan item when used by doctor. Records: item scanned, patient used on, doctor/provider, procedure/date, staff member who scanned, office location, consumed date/time.',
          routing: 'Step 2 of 2 — Consumption + Patient Linkage',
          routingColor: 'text-red-700 bg-red-100',
          tab: 'implant-grafting',
          btnLabel: 'Implant & Grafting → Bone/Tissue',
          btnColor: 'bg-blue-600 hover:bg-blue-700',
        },
        {
          icon: 'ScanLine',
          title: 'Implant — Scan In (Receive)',
          desc: 'Scan implant when it arrives at the office. Records: company, system, platform size, length, diameter, lot/serial, expiration, office, quantity, staff member, received date/time.',
          routing: 'Step 1 of 2 — Receiving',
          routingColor: 'text-amber-700 bg-amber-100',
          tab: 'implant-grafting',
          btnLabel: 'Implant & Grafting → Implant Inventory',
          btnColor: 'bg-emerald-600 hover:bg-emerald-700',
        },
        {
          icon: 'PackageMinus',
          title: 'Implant — Scan Out (Consume)',
          desc: 'Scan implant when placed by doctor. Records: implant scanned, patient used on, doctor/provider, procedure/date, staff member who scanned, office location, consumed date/time.',
          routing: 'Step 2 of 2 — Consumption + Patient Linkage',
          routingColor: 'text-red-700 bg-red-100',
          tab: 'implant-grafting',
          btnLabel: 'Implant & Grafting → Implant Inventory',
          btnColor: 'bg-blue-600 hover:bg-blue-700',
        },
      ],
    },
    {
      section: 'Patient Traceability',
      color: 'purple',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      borderColor: 'border-purple-200',
      bgColor: 'bg-purple-50',
      items: [
        {
          icon: 'UserCheck',
          title: 'Usage Log — Patient-Level Traceability',
          desc: 'View item-level usage history for bone, tissue, membrane, and implants. Tracks patient, doctor/provider, staff member, office, and date for every high-ticket item used.',
          routing: 'PHI permitted — authorized dashboard only',
          routingColor: 'text-purple-700 bg-purple-100',
          tab: 'implant-grafting',
          btnLabel: 'Implant & Grafting → Usage Log',
          btnColor: 'bg-purple-600 hover:bg-purple-700',
        },
      ],
    },
  ];

  return (
    <div className="mb-6 rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
      <div className="mb-4 flex items-start gap-2 text-xs text-cyan-800">
        <Icon name="Info" size={13} className="text-cyan-600 flex-shrink-0 mt-0.5" />
        <span>
          <strong>Source:</strong> All inventory data is Supabase-managed operational workflow data. Dentrix/FastAPI is <strong>not</strong> the source for physical inventory.
          Patient-level tracking is operationally required for bone/tissue/membrane/implant traceability and is permitted inside this authorized dashboard.
          Missing or null values display as <strong>—</strong> or <strong>N/A</strong>.
        </span>
      </div>
      <div className="space-y-5">
        {cards?.map((section) => (
          <div key={section?.section}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-5 h-5 rounded-lg ${section?.iconBg} flex items-center justify-center`}>
                <Icon name="Layers" size={11} className={section?.iconColor} />
              </div>
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">{section?.section}</h3>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-3">
              {section?.items?.map((card) => (
                <div
                  key={card?.title}
                  className={`rounded-xl border ${section?.borderColor} ${section?.bgColor} p-3 flex flex-col gap-2`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`w-6 h-6 rounded-lg ${section?.iconBg} flex items-center justify-center flex-shrink-0`}>
                      <Icon name={card?.icon} size={12} className={section?.iconColor} />
                    </div>
                    <p className="text-xs font-bold text-foreground leading-tight">{card?.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{card?.desc}</p>
                  <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full w-fit ${card?.routingColor}`}>
                    {card?.routing}
                  </span>
                  <button
                    onClick={() => onTabChange(card?.tab)}
                    className={`mt-auto flex items-center justify-center gap-1.5 px-3 py-1.5 ${card?.btnColor} text-white rounded-xl text-xs font-semibold transition-colors`}
                  >
                    <Icon name="ArrowRight" size={12} />
                    {card?.btnLabel}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'implant-grafting', label: 'Implant & Grafting', icon: 'Syringe' },
  { id: 'front-desk',       label: 'Front Desk',         icon: 'ClipboardList' },
  { id: 'monthly-supply',   label: 'Clinical Supply',    icon: 'ShoppingCart' },
];

const TAB_PARAM_MAP = {
  'implant-grafting': 'implant-grafting',
  'front-desk':       'front-desk',
  'monthly-supply':   'monthly-supply',
  // Legacy param aliases — redirect old deep-links into implant-grafting
  'overview':         'implant-grafting',
  'bone-tissue':      'implant-grafting',
  'implant':          'implant-grafting',
  'usage-log':        'implant-grafting',
  'bulk-import':      'implant-grafting',
  'reports':          'implant-grafting',
  'settings':         'implant-grafting',
};

const InventoryDashboard = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const { hasPermission, loading: permLoading } = useRolePermissions();
  const [searchParams, setSearchParams] = useSearchParams();

  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isAdmin = userProfile?.role === 'admin' || isSuperAdmin;
  const canEditInventory = hasPermission('inventory:edit');
  const canReadMaterialReview = ['c54cedd6-982b-4992-a93a-4188aae288a7','b6e77501-3357-4a25-8655-66746b2eb53d'].includes(userProfile?.id);
  const canManageStock = canEditInventory && hasPermission('purchasing.records.manage');

  // ── Inventory tab permission map ──────────────────────────────────────────
  const INV_TAB_PERMISSION_MAP = {
    'implant-grafting': 'resources.inventory.overview.view',
    'front-desk':       'resources.inventory.front_desk.view',
    'monthly-supply':   'resources.inventory.monthly_supply.view',
  };

  // Compute allowed inventory tabs
  const allowedInvTabs = React.useMemo(() => {
    if (isSuperAdmin) return TABS;
    return TABS?.filter(tab => hasPermission(INV_TAB_PERMISSION_MAP?.[tab?.id]));
  }, [isSuperAdmin, hasPermission, permLoading]);

  const tabParam = searchParams?.get('tab');
  const initialTab = ['usage-allocation','historical-usage'].includes(tabParam) ? tabParam : tabParam==='stock-records'?'stock-records':TAB_PARAM_MAP?.[tabParam] || 'implant-grafting';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [supplyOfflinePending, setSupplyOfflinePending] = useState(0);
  const [showWorkflowGuide, setShowWorkflowGuide] = useState(false);

  const handleTabChange = (tabId) => {
    if (tabId === 'request-supplies') { navigate('/request-supplies'); return; }
    // Map legacy tab IDs to new structure
    const resolved = TAB_PARAM_MAP?.[tabId] || tabId;
    setActiveTab(resolved);
    setSearchParams({ tab: resolved });
    setShowWorkflowGuide(false);
  };

  // Sync tab from URL param changes
  useEffect(() => {
    const param = searchParams?.get('tab');
    if (['usage-allocation','historical-usage'].includes(param)) { setActiveTab(param); return; }
    if (param && TAB_PARAM_MAP?.[param]) {
      setActiveTab(TAB_PARAM_MAP?.[param]);
    }
  }, [searchParams]);

  // Switch to first allowed tab if current is restricted
  useEffect(() => {
    if ((canReadMaterialReview && activeTab==='historical-usage') || (canViewAllocation(userProfile) && activeTab==='usage-allocation') || permLoading || isSuperAdmin || (canManageStock && activeTab==='stock-records')) return;
    if (allowedInvTabs?.length > 0 && !allowedInvTabs?.find(t => t?.id === activeTab)) {
      setActiveTab(allowedInvTabs?.[0]?.id);
    }
  }, [userProfile, canReadMaterialReview, allowedInvTabs, activeTab, permLoading, isSuperAdmin, canManageStock]);

  useEffect(() => {
    const countSupplyPending = async () => {
      try {
        const all = await offlineQueueService?.getAll();
        const count = all?.filter(i =>
          (i?.status === 'pending' || i?.status === 'failed') &&
          (i?.type === 'supply_adjustment' || i?.type === 'supply_urgent_request')
        )?.length;
        setSupplyOfflinePending(count || 0);
      } catch (_) {}
    };
    countSupplyPending();
    const unsub = offlineQueueService?.onSyncStatusChange(() => countSupplyPending());
    return () => unsub?.();
  }, []);

  const visibleTabs = isSuperAdmin
    ? TABS
    : allowedInvTabs?.length > 0
      ? allowedInvTabs
      : TABS;

  // Page-level guard
  if (!permLoading && userProfile && !isSuperAdmin && !hasPermission('inventory:view') && !hasPermission('resources.inventory.view') && allowedInvTabs?.length === 0) {
    return <section className="p-5 space-y-3"><h1 className="text-xl font-semibold">Inventory</h1><Link className="text-primary underline" to="/request-supplies?tab=inventory">Open assigned office inventory</Link>
      {canViewAllocation(userProfile) && <div><Link className="text-primary underline" to="/inventory-dashboard?tab=usage-allocation">Usage allocation</Link>{activeTab==='usage-allocation' && <UsageAllocation/>}</div>}
      {canReadMaterialReview && <div><Link className="text-primary underline" to="/inventory-dashboard?tab=historical-usage">Historical usage</Link>{activeTab==='historical-usage' && <HistoricalUsageReview/>}</div>}
    </section>;
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="main-content">
        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon name="LayoutGrid" size={18} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Inventory</h1>
              <p className="text-xs text-muted-foreground">Physical inventory, high-ticket tracking, and supply workflow across all Nu Dental locations.</p>
            </div>
          </div>
          <button
            onClick={() => setShowWorkflowGuide(v => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-cyan-300 bg-cyan-50 text-cyan-800 text-xs font-semibold hover:bg-cyan-100 transition-colors flex-shrink-0"
          >
            <Icon name={showWorkflowGuide ? 'ChevronUp' : 'Map'} size={13} />
            {showWorkflowGuide ? 'Hide Workflow Guide' : 'Workflow Guide'}
          </button>
        </div>

        <Link className="inline-block mb-4 text-primary underline" to="/request-supplies?tab=inventory">Office supply inventory</Link>
        {/* ── Workflow Guide (collapsible) ── */}
        {showWorkflowGuide && (
          <WorkflowGuidePanel onTabChange={handleTabChange} />
        )}

        {/* ── Top-Level Tab Row ── */}
        <div className="flex flex-wrap gap-1.5 mb-5 border-b border-border pb-3">
          {canManageStock && <button className={activeTab==='stock-records'?'rounded-xl bg-primary text-primary-foreground px-3 py-2':'rounded-xl border px-3 py-2'} onClick={()=>handleTabChange('stock-records')}>Stock records</button>}
          {canReadMaterialReview && <button className={activeTab==='historical-usage'?'rounded-xl bg-primary text-primary-foreground px-3 py-2':'rounded-xl border px-3 py-2'} onClick={()=>handleTabChange('historical-usage')}>Historical usage</button>}
          {canViewAllocation(userProfile) && <button className={activeTab==='usage-allocation'?'rounded-xl bg-primary text-primary-foreground px-3 py-2':'rounded-xl border px-3 py-2'} onClick={()=>handleTabChange('usage-allocation')}>Usage allocation</button>}
          {visibleTabs?.map(tab => {
            const isActive = activeTab === tab?.id;
            const badge = tab?.id === 'monthly-supply' && supplyOfflinePending > 0 ? supplyOfflinePending : null;
            const routingBadge =
              tab?.id === 'front-desk' ? { label: 'Regional Manager', color: 'bg-blue-100 text-blue-700' } :
              tab?.id === 'monthly-supply' ? { label: 'Clinical Manager', color: 'bg-emerald-100 text-emerald-700' } :
              null;
            return (
              <button
                key={tab?.id}
                onClick={() => handleTabChange(tab?.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border ${
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground hover:bg-primary/5'
                }`}
              >
                <Icon name={tab?.icon} size={12} />
                {tab?.label}
                {routingBadge && (
                  <span className={`ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : routingBadge?.color}`}>
                    {routingBadge?.label}
                  </span>
                )}
                {badge && (
                  <span className="ml-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {canReadMaterialReview && activeTab==='historical-usage' && <HistoricalUsageReview/>}
        {canViewAllocation(userProfile) && activeTab==='usage-allocation' && <UsageAllocation/>}
        {canManageStock && activeTab==='stock-records' && <PurchasingRecords inventoryOnly/>}
        {/* ── TAB: IMPLANT & GRAFTING ── */}
        {activeTab === 'implant-grafting' && (
          <ImplantGraftingTab />
        )}

        {/* ── TAB: MONTHLY SUPPLY (Clinical Supply) ── */}
        {activeTab === 'monthly-supply' && (
          <MonthlySupplyModule />
        )}

        {/* ── TAB: FRONT DESK ── */}
        {activeTab === 'front-desk' && (
          <FrontDeskInventoryTab />
        )}
      </main>
    </div>
  );
};

export default InventoryDashboard;
