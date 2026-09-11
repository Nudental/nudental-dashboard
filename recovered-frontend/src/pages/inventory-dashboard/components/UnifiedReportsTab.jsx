import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import { useAuth } from '../../../contexts/AuthContext';
import ImplantReportsTab from '../../implant-inventory-management/components/ImplantReportsTab';


const UnifiedReportsTab = () => {
  const { userProfile } = useAuth();
  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isAdmin = userProfile?.role === 'admin' || isSuperAdmin;

  const [section, setSection] = useState('bone_tissue');
  const [BoneReportsTab, setBoneReportsTab] = useState(null);
  const [ImplantReportsTab, setImplantReportsTab] = useState(null);
  const [boneRecords, setBoneRecords] = useState([]);
  const [implantRecords, setImplantRecords] = useState([]);
  const [implantUsage, setImplantUsage] = useState([]);
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    import('../../bone-and-tissue-inventory/components/ReportsTab')?.then(m => setBoneReportsTab(() => m?.default));
    import('../../implant-inventory-management/components/ImplantReportsTab')?.then(m => setImplantReportsTab(() => m?.default));
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [boneSvc, implantSvc] = await Promise.all([
          import('../../../services/boneTissueService'),
          import('../../../services/implantInventoryService'),
        ]);
        const [boneData, implantData, implantUsageData, officesData] = await Promise.all([
          boneSvc?.fetchInventory(),
          implantSvc?.fetchInventory(),
          implantSvc?.fetchUsageLogs(),
          implantSvc?.fetchOffices(),
        ]);
        setBoneRecords(boneData);
        setImplantRecords(implantData);
        setImplantUsage(implantUsageData);
        setOffices(officesData);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    loadData();
  }, []);

  const SECTIONS = [
    { id: 'bone_tissue', label: 'Bone & Tissue Reports', icon: 'Package' },
    { id: 'implant', label: 'Implant Reports', icon: 'Syringe' },
    { id: 'combined', label: 'Combined Reports', icon: 'BarChart3' },
  ];

  const handleExportCombinedCSV = (type) => {
    let rows = [];
    let headers = [];
    let filename = '';

    if (type === 'all_inventory') {
      headers = ['Type', 'Office', 'Product Name', 'Category', 'Status', 'Expiration Date', 'ID Number', 'Lot Number'];
      const btRows = boneRecords?.map(r => ['Bone/Tissue', r?.office_name, r?.product_name, r?.bone_tissue_type, r?.item_status, r?.expiration_date, r?.identification_number, r?.lot_number]);
      const implantRows = implantRecords?.map(r => ['Implant', r?.office_name, r?.product_name, 'Implant', r?.status, r?.expiration_date, r?.identification_number, r?.lot_number]);
      rows = [...btRows, ...implantRows];
      filename = 'all-inventory';
    } else if (type === 'low_stock') {
      headers = ['Type', 'Office', 'Product Name', 'Current Stock', 'Min Stock'];
      const btLow = boneRecords?.filter(r => r?.item_status === 'In Stock')?.map(r => ['Bone/Tissue', r?.office_name, r?.product_name, '—', '—']);
      const implantLow = implantRecords?.filter(r => r?.quantity_in_stock <= (r?.minimum_stock_level || 2))?.map(r => ['Implant', r?.office_name, r?.product_name, r?.quantity_in_stock, r?.minimum_stock_level]);
      rows = [...btLow, ...implantLow];
      filename = 'low-stock';
    } else if (type === 'expiring') {
      const today = new Date();
      const in90 = new Date(today); in90?.setDate(today?.getDate() + 90);
      headers = ['Type', 'Office', 'Product Name', 'Expiration Date', 'ID Number'];
      const btExp = boneRecords?.filter(r => r?.expiration_date && new Date(r?.expiration_date) <= in90)?.map(r => ['Bone/Tissue', r?.office_name, r?.product_name, r?.expiration_date, r?.identification_number]);
      const implantExp = implantRecords?.filter(r => r?.expiration_date && new Date(r?.expiration_date) <= in90)?.map(r => ['Implant', r?.office_name, r?.product_name, r?.expiration_date, r?.identification_number]);
      rows = [...btExp, ...implantExp];
      filename = 'expiring-inventory';
    } else if (type === 'usage') {
      headers = ['Type', 'Date', 'Office', 'Provider', 'Patient', 'Product Name', 'ID Number', 'Status'];
      const btUsage = boneRecords?.filter(r => r?.item_status === 'Used')?.map(r => ['Bone/Tissue', r?.procedure_date, r?.office_name, r?.provider_name, r?.patient_name, r?.product_name, r?.identification_number, r?.item_status]);
      const implantUsageRows = implantUsage?.map(r => ['Implant', r?.procedure_date, r?.office_name, r?.provider_name, r?.patient_name, [r?.company_name, r?.system_name]?.filter(Boolean)?.join(' / ') || '—', r?.identification_number, r?.item_status]);
      rows = [...btUsage, ...implantUsageRows];
      filename = 'combined-usage';
    }

    const csv = [headers, ...rows]?.map(row => row?.map(cell => `"${String(cell || '')?.replace(/"/g, '""')}"`)?.join(','))?.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL?.createObjectURL(blob);
    const a = document?.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date()?.toISOString()?.slice(0, 10)}.csv`;
    a?.click();
    URL?.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-foreground">Inventory Reports</h2>
        <p className="text-sm text-muted-foreground">Generate and export reports across all inventory modules.</p>
      </div>

      {/* Section selector */}
      <div className="flex items-center gap-1 border-b border-border">
        {SECTIONS?.map(s => (
          <button
            key={s?.id}
            onClick={() => setSection(s?.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              section === s?.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name={s?.icon} size={14} />{s?.label}
          </button>
        ))}
      </div>

      {/* Bone & Tissue Reports */}
      {section === 'bone_tissue' && (
        loading || !BoneReportsTab ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <BoneReportsTab records={boneRecords} />
        )
      )}

      {/* Implant Reports */}
      {section === 'implant' && (
        loading || !ImplantReportsTab ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <ImplantReportsTab inventoryRecords={implantRecords} usageRecords={implantUsage} offices={offices} />
        )
      )}

      {/* Combined Reports */}
      {section === 'combined' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Cross-module reports combining bone, tissue, and implant data across all locations.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { id: 'all_inventory', title: 'All Inventory by Location', desc: 'Complete inventory list across all modules and offices', icon: 'Package' },
              { id: 'low_stock', title: 'All Low Stock by Location', desc: 'Items at or below minimum stock level across all modules', icon: 'AlertTriangle' },
              { id: 'expiring', title: 'All Expiring Inventory', desc: 'Items expiring within 90 days across all modules', icon: 'Clock' },
              { id: 'usage', title: 'Combined Usage Report', desc: 'All bone, tissue, and implant usage entries', icon: 'ClipboardList' },
            ]?.map(report => (
              <div key={report?.id} className="border border-border rounded-xl p-5 hover:border-primary/40 hover:bg-primary/5 transition-colors">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon name={report?.icon} size={16} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{report?.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{report?.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExportCombinedCSV(report?.id)}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    <Icon name="Download" size={12} />Export CSV
                  </button>
                  {loading && <span className="text-xs text-muted-foreground">Loading data...</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
            {[
              { label: 'Total Bone/Tissue Records', value: boneRecords?.length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Total Implant Records', value: implantRecords?.length, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Total Usage Entries', value: (boneRecords?.filter(r => r?.item_status === 'Used')?.length || 0) + (implantUsage?.length || 0), color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Expiring in 90 Days', value: (() => { const t = new Date(); const d = new Date(t); d?.setDate(t?.getDate() + 90); return (boneRecords?.filter(r => r?.expiration_date && new Date(r?.expiration_date) <= d)?.length || 0) + (implantRecords?.filter(r => r?.expiration_date && new Date(r?.expiration_date) <= d)?.length || 0); })(), color: 'text-amber-600', bg: 'bg-amber-50' },
            ]?.map(stat => (
              <div key={stat?.label} className={`${stat?.bg} rounded-xl p-4 border border-border`}>
                <p className={`text-2xl font-bold ${stat?.color}`}>{loading ? '—' : stat?.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat?.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedReportsTab;
