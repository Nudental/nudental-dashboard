import { supabase } from '../lib/supabase';

const OFFICES = [
  'Nu Dental of Eatontown',
  'Nu Dental of Brick',
  'Nu Dental of Barnegat',
  'Nu Dental of Staten Island',
];

export const getOffices = () => OFFICES;

// ── Stock by Location ─────────────────────────────────────────────────────
export const fetchStockByLocation = async (officeFilter = null) => {
  const today = new Date()?.toISOString()?.split('T')?.[0];
  const in30 = new Date(); in30?.setDate(in30?.getDate() + 30);
  const in30Str = in30?.toISOString()?.split('T')?.[0];

  // Bone/Tissue stock
  let btQuery = supabase
    ?.from('bone_tissue_stock')
    ?.select('office_name, product_name, current_stock, minimum_stock_level, expiration_date');
  if (officeFilter) btQuery = btQuery?.eq('office_name', officeFilter);
  const { data: btStock, error: btErr } = await btQuery;
  if (btErr) console.error('BT stock error:', btErr);

  // Implant inventory
  let implantQuery = supabase
    ?.from('implant_inventory')
    ?.select('office_name, quantity_in_stock, minimum_stock_level, expiration_date, item_status');
  if (officeFilter) implantQuery = implantQuery?.eq('office_name', officeFilter);
  const { data: implantData, error: implantErr } = await implantQuery;
  if (implantErr) console.error('Implant error:', implantErr);

  const offices = officeFilter ? [officeFilter] : OFFICES;
  const result = {};

  offices?.forEach(office => {
    result[office] = {
      office,
      boneTissueTotal: 0,
      implantTotal: 0,
      lowStockCount: 0,
      expiredCount: 0,
      expiringSoonCount: 0,
    };
  });

  (btStock || [])?.forEach(item => {
    const o = item?.office_name;
    if (!result?.[o]) return;
    result[o].boneTissueTotal += (item?.current_stock || 0);
    if ((item?.current_stock || 0) <= (item?.minimum_stock_level || 2)) result[o].lowStockCount++;
    if (item?.expiration_date) {
      if (item?.expiration_date < today) result[o].expiredCount++;
      else if (item?.expiration_date <= in30Str) result[o].expiringSoonCount++;
    }
  });

  (implantData || [])?.forEach(item => {
    const o = item?.office_name;
    if (!result?.[o]) return;
    if (item?.item_status === 'in_stock') {
      result[o].implantTotal += (item?.quantity_in_stock || 0);
      if ((item?.quantity_in_stock || 0) <= (item?.minimum_stock_level || 2)) result[o].lowStockCount++;
    }
    if (item?.expiration_date) {
      if (item?.expiration_date < today) result[o].expiredCount++;
      else if (item?.expiration_date <= in30Str) result[o].expiringSoonCount++;
    }
  });

  return Object.values(result);
};

// ── Low Stock Alerts ──────────────────────────────────────────────────────
export const fetchLowStockAlerts = async (officeFilter = null, typeFilter = null) => {
  const alerts = [];

  if (!typeFilter || typeFilter === 'All' || ['Bone', 'Tissue', 'Membrane', 'PRF']?.includes(typeFilter)) {
    let q = supabase
      ?.from('bone_tissue_stock')
      ?.select('id, office_name, product_name, identification_number, current_stock, minimum_stock_level, bone_tissue_type');
    if (officeFilter) q = q?.eq('office_name', officeFilter);
    const { data, error } = await q;
    if (!error) {
      (data || [])?.forEach(item => {
        if ((item?.current_stock || 0) <= (item?.minimum_stock_level || 2)) {
          alerts?.push({
            id: item?.id,
            office: item?.office_name || '',
            category: item?.bone_tissue_type || 'Bone/Tissue',
            productName: item?.product_name || '',
            idNumber: item?.identification_number || '',
            currentStock: item?.current_stock || 0,
            minLevel: item?.minimum_stock_level || 2,
            source: 'bone_tissue',
          });
        }
      });
    }
  }

  if (!typeFilter || typeFilter === 'All' || typeFilter === 'Implant') {
    let q = supabase
      ?.from('implant_inventory')
      ?.select('id, office_name, company_name, system_name, identification_number, quantity_in_stock, minimum_stock_level, item_status');
    if (officeFilter) q = q?.eq('office_name', officeFilter);
    const { data, error } = await q;
    if (!error) {
      (data || [])?.forEach(item => {
        if (item?.item_status === 'in_stock' && (item?.quantity_in_stock || 0) <= (item?.minimum_stock_level || 2)) {
          alerts?.push({
            id: item?.id,
            office: item?.office_name || '',
            category: 'Implant',
            productName: `${item?.company_name || ''} ${item?.system_name || ''}`?.trim(),
            idNumber: item?.identification_number || '',
            currentStock: item?.quantity_in_stock || 0,
            minLevel: item?.minimum_stock_level || 2,
            source: 'implant',
          });
        }
      });
    }
  }

  return alerts?.sort((a, b) => a?.currentStock - b?.currentStock);
};

// ── Expiration Timeline ───────────────────────────────────────────────────
export const fetchExpirationData = async (officeFilter = null, typeFilter = null) => {
  const today = new Date();
  const todayStr = today?.toISOString()?.split('T')?.[0];
  const in30 = new Date(today); in30?.setDate(today?.getDate() + 30);
  const in60 = new Date(today); in60?.setDate(today?.getDate() + 60);
  const in90 = new Date(today); in90?.setDate(today?.getDate() + 90);
  const in30Str = in30?.toISOString()?.split('T')?.[0];
  const in60Str = in60?.toISOString()?.split('T')?.[0];
  const in90Str = in90?.toISOString()?.split('T')?.[0];

  const items = [];

  if (!typeFilter || typeFilter === 'All' || ['Bone', 'Tissue', 'Membrane', 'PRF']?.includes(typeFilter)) {
    let q = supabase
      ?.from('bone_tissue_inventory')
      ?.select('id, office_name, bone_tissue_type, product_name, identification_number, lot_number, expiration_date')
      ?.not('expiration_date', 'is', null)
      ?.lte('expiration_date', in90Str);
    if (officeFilter) q = q?.eq('office_name', officeFilter);
    const { data, error } = await q;
    if (!error) {
      (data || [])?.forEach(item => {
        const expDate = new Date(item?.expiration_date);
        const daysUntil = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
        items?.push({
          id: item?.id,
          office: item?.office_name || '',
          type: item?.bone_tissue_type || 'Bone/Tissue',
          productName: item?.product_name || '',
          idNumber: item?.identification_number || '',
          lotNumber: item?.lot_number || '',
          expirationDate: item?.expiration_date,
          daysUntil,
          expired: item?.expiration_date < todayStr,
        });
      });
    }
  }

  if (!typeFilter || typeFilter === 'All' || typeFilter === 'Implant') {
    let q = supabase
      ?.from('implant_inventory')
      ?.select('id, office_name, company_name, system_name, identification_number, lot_number, expiration_date')
      ?.not('expiration_date', 'is', null)
      ?.lte('expiration_date', in90Str);
    if (officeFilter) q = q?.eq('office_name', officeFilter);
    const { data, error } = await q;
    if (!error) {
      (data || [])?.forEach(item => {
        const expDate = new Date(item?.expiration_date);
        const daysUntil = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
        items?.push({
          id: item?.id,
          office: item?.office_name || '',
          type: 'Implant',
          productName: `${item?.company_name || ''} ${item?.system_name || ''}`?.trim(),
          idNumber: item?.identification_number || '',
          lotNumber: item?.lot_number || '',
          expirationDate: item?.expiration_date,
          daysUntil,
          expired: item?.expiration_date < todayStr,
        });
      });
    }
  }

  // Build chart data per office
  const chartData = {};
  OFFICES?.forEach(o => {
    chartData[o] = { office: o, within30: 0, within60: 0, within90: 0, expired: 0 };
  });

  items?.forEach(item => {
    const o = item?.office;
    if (!chartData?.[o]) chartData[o] = { office: o, within30: 0, within60: 0, within90: 0, expired: 0 };
    if (item?.expired) chartData[o].expired++;
    else if (item?.daysUntil <= 30) chartData[o].within30++;
    else if (item?.daysUntil <= 60) chartData[o].within60++;
    else chartData[o].within90++;
  });

  return {
    items: items?.sort((a, b) => a?.daysUntil - b?.daysUntil),
    chartData: Object.values(chartData),
  };
};

// ── Usage Trends ──────────────────────────────────────────────────────────
export const fetchUsageTrends = async (officeFilter = null, months = 6) => {
  const now = new Date();
  const fromDate = new Date(now);
  fromDate?.setMonth(fromDate?.getMonth() - months);
  const fromStr = fromDate?.toISOString();

  // Bone/Tissue usage (status = Used)
  let btQ = supabase
    ?.from('bone_tissue_inventory')
    ?.select('office_name, updated_at, item_status')
    ?.eq('item_status', 'Used')
    ?.gte('updated_at', fromStr);
  if (officeFilter) btQ = btQ?.eq('office_name', officeFilter);
  const { data: btUsage, error: btErr } = await btQ;
  if (btErr) console.error('BT usage error:', btErr);

  // Implant usage logs
  let implantQ = supabase
    ?.from('implant_usage_logs')
    ?.select('office_name, procedure_date')
    ?.gte('procedure_date', fromStr?.split('T')?.[0]);
  if (officeFilter) implantQ = implantQ?.eq('office_name', officeFilter);
  const { data: implantUsage, error: implantErr } = await implantQ;
  if (implantErr) console.error('Implant usage error:', implantErr);

  // Build monthly buckets
  const monthLabels = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now);
    d?.setMonth(d?.getMonth() - i);
    monthLabels?.push(`${d?.getFullYear()}-${String(d?.getMonth() + 1)?.padStart(2, '0')}`);
  }

  const btByOffice = {};
  const implantByOffice = {};
  const offices = officeFilter ? [officeFilter] : OFFICES;

  offices?.forEach(o => {
    btByOffice[o] = {};
    implantByOffice[o] = {};
    monthLabels?.forEach(m => {
      btByOffice[o][m] = 0;
      implantByOffice[o][m] = 0;
    });
  });

  (btUsage || [])?.forEach(item => {
    const o = item?.office_name;
    if (!btByOffice?.[o]) return;
    const m = (item?.updated_at || '')?.substring(0, 7);
    if (btByOffice?.[o]?.[m] !== undefined) btByOffice[o][m]++;
  });

  (implantUsage || [])?.forEach(item => {
    const o = item?.office_name;
    if (!implantByOffice?.[o]) return;
    const m = (item?.procedure_date || '')?.substring(0, 7);
    if (implantByOffice?.[o]?.[m] !== undefined) implantByOffice[o][m]++;
  });

  // Format for Recharts
  const btChartData = monthLabels?.map(m => {
    const entry = { month: m };
    offices?.forEach(o => { entry[o] = btByOffice?.[o]?.[m] || 0; });
    return entry;
  });

  const implantChartData = monthLabels?.map(m => {
    const entry = { month: m };
    offices?.forEach(o => { entry[o] = implantByOffice?.[o]?.[m] || 0; });
    return entry;
  });

  // Summary table
  const thisMonth = `${now?.getFullYear()}-${String(now?.getMonth() + 1)?.padStart(2, '0')}`;
  const thisQuarterMonths = monthLabels?.slice(-3);

  const summary = offices?.map(o => ({
    office: o,
    boneUsed: Object.values(btByOffice?.[o] || {})?.reduce((a, b) => a + b, 0),
    tissueUsed: 0,
    implantsUsed: Object.values(implantByOffice?.[o] || {})?.reduce((a, b) => a + b, 0),
    totalThisMonth: (btByOffice?.[o]?.[thisMonth] || 0) + (implantByOffice?.[o]?.[thisMonth] || 0),
    totalThisQuarter: thisQuarterMonths?.reduce((sum, m) => sum + (btByOffice?.[o]?.[m] || 0) + (implantByOffice?.[o]?.[m] || 0), 0),
  }));

  return { btChartData, implantChartData, summary, monthLabels, offices };
};
