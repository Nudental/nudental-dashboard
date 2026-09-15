import { supabase } from '../lib/supabase';
import { OFFICE_LIST } from '../constants/offices';
import { dashboardEnvironment } from '../config/dashboardEnvironment';

export const OFFICE_NAMES = [
  'Nu Dental of Eatontown',
  'Nu Dental of Brick',
  'Nu Dental of Barnegat',
  'Nu Dental of Staten Island',
];

export const OFFICE_NAMES_LOWER = OFFICE_NAMES?.map(n => n?.toLowerCase());

export const BT_CATEGORIES = ['Bone', 'Tissue', 'Membrane', 'PRF'];
export const BT_STATUSES = ['In Stock', 'Used', 'Returned', 'Wasted', 'Expired'];
export const IMPLANT_STATUSES = ['in_stock', 'used', 'returned', 'wasted', 'expired'];
export const IMPLANT_STATUS_LABELS = { in_stock: 'In Stock', used: 'Used', returned: 'Returned', wasted: 'Wasted', expired: 'Expired' };

// ── Fetch offices ─────────────────────────────────────────────────────────
export const fetchOfficesForImport = async () => {
  if (dashboardEnvironment.isQa) {
    const { data, error } = await supabase?.from('offices')?.select('id, name')?.eq('is_active', true)?.order('name');
    if (error) throw error;
    return data || [];
  }
  // Use the central OFFICE_LIST constant (single source of truth for the 4 Nu Dental offices).
  // This avoids the mismatch where the DB stores short names ('Eatontown') but
  // OFFICE_NAMES_LOWER expected full names ('nu dental of eatontown'), causing an empty result.
  return OFFICE_LIST?.map(o => ({ id: o?.id, name: o?.name }));
};

// ── Resolve office_id from name ───────────────────────────────────────────
export const resolveOfficeId = (officeName, offices) => {
  if (!officeName) return null;
  const match = offices?.find(o => o?.name?.toLowerCase() === officeName?.trim()?.toLowerCase());
  return match?.id || null;
};

// ── Check duplicate identification numbers in DB ──────────────────────────
export const checkDuplicateIdNumbers = async (idNumbers, tableName) => {
  if (!idNumbers?.length) return [];
  const { data, error } = await supabase?.from(tableName)?.select('identification_number')?.in('identification_number', idNumbers);
  if (error) throw error;
  return (data || [])?.map(r => r?.identification_number);
};

// ── Validate bone/tissue rows ─────────────────────────────────────────────
export const validateBoneTissueRows = async (rows, selectedOfficeId, offices, isSuperAdmin) => {
  const idNumbers = rows?.map(r => r?.identification_number?.trim())?.filter(Boolean);
  const existingIds = await checkDuplicateIdNumbers(idNumbers, 'bone_tissue_inventory');

  return rows?.map((row, idx) => {
    const errors = [];
    const warnings = [];

    // Practice location
    let resolvedOfficeId = selectedOfficeId;
    let resolvedOfficeName = '';
    if (row?.practice_location?.trim()) {
      const matched = offices?.find(o => o?.name?.toLowerCase() === row?.practice_location?.trim()?.toLowerCase());
      if (!matched) {
        errors?.push(`practice_location "${row?.practice_location}" is not a valid Nu Dental office`);
      } else {
        resolvedOfficeId = matched?.id;
        resolvedOfficeName = matched?.name;
      }
    } else if (selectedOfficeId) {
      const off = offices?.find(o => o?.id === selectedOfficeId);
      resolvedOfficeName = off?.name || '';
    } else {
      errors?.push('practice_location is required — select a location or include it in the file');
    }

    // Category
    if (!row?.category?.trim()) {
      errors?.push('category is required (Bone, Tissue, Membrane, PRF)');
    } else if (!BT_CATEGORIES?.map(c => c?.toLowerCase())?.includes(row?.category?.trim()?.toLowerCase())) {
      errors?.push(`category must be one of: ${BT_CATEGORIES?.join(', ')}`);
    }

    // Product name
    if (!row?.product_name?.trim()) errors?.push('product_name is required');

    // Quantity
    if (!row?.quantity_added?.toString()?.trim()) {
      errors?.push('quantity_added is required');
    } else {
      const qty = parseInt(row?.quantity_added, 10);
      if (isNaN(qty) || qty <= 0) errors?.push('quantity_added must be a positive integer');
    }

    // Expiration date
    if (row?.expiration_date?.trim()) {
      if (!/^\d{4}-\d{2}-\d{2}$/?.test(row?.expiration_date?.trim())) {
        errors?.push('expiration_date must be YYYY-MM-DD format');
      } else {
        const expDate = new Date(row.expiration_date.trim());
        if (isNaN(expDate?.getTime())) {
          errors?.push('expiration_date is not a valid date');
        } else if (expDate < new Date()) {
          warnings?.push('expiration_date is already expired');
        }
      }
    }

    // Status
    if (row?.status?.trim() && !BT_STATUSES?.map(s => s?.toLowerCase())?.includes(row?.status?.trim()?.toLowerCase())) {
      warnings?.push(`status "${row?.status}" is not recognized — will default to "In Stock"`);
    }

    // Duplicate ID check
    if (row?.identification_number?.trim() && existingIds?.includes(row?.identification_number?.trim())) {
      if (isSuperAdmin) {
        warnings?.push(`identification_number "${row?.identification_number}" already exists in inventory (Super Admin override allowed)`);
      } else {
        errors?.push(`identification_number "${row?.identification_number}" already exists in inventory`);
      }
    }

    // Duplicate within file
    const dupeInFile = rows?.findIndex((r2, i2) => i2 !== idx && r2?.identification_number?.trim() === row?.identification_number?.trim() && row?.identification_number?.trim());
    if (dupeInFile !== -1 && dupeInFile < idx) {
      warnings?.push(`identification_number "${row?.identification_number}" is duplicated within this import file (row ${dupeInFile + 1})`);
    }

    const status = errors?.length > 0 ? 'error' : warnings?.length > 0 ? 'warning' : 'valid';
    return {
      ...row,
      _rowIndex: idx,
      _errors: errors,
      _warnings: warnings,
      _status: status,
      _resolvedOfficeId: resolvedOfficeId,
      _resolvedOfficeName: resolvedOfficeName,
    };
  });
};

// ── Validate implant rows ─────────────────────────────────────────────────
export const validateImplantRows = async (rows, selectedOfficeId, offices, companies, systems, platformSizes, lengths, diameters, isSuperAdmin) => {
  const idNumbers = rows?.map(r => r?.identification_number?.trim())?.filter(Boolean);
  const existingIds = await checkDuplicateIdNumbers(idNumbers, 'implant_inventory');

  return rows?.map((row, idx) => {
    const errors = [];
    const warnings = [];
    const autoCreate = [];

    // Practice location
    let resolvedOfficeId = selectedOfficeId;
    let resolvedOfficeName = '';
    if (row?.practice_location?.trim()) {
      const matched = offices?.find(o => o?.name?.toLowerCase() === row?.practice_location?.trim()?.toLowerCase());
      if (!matched) {
        errors?.push(`practice_location "${row?.practice_location}" is not a valid Nu Dental office`);
      } else {
        resolvedOfficeId = matched?.id;
        resolvedOfficeName = matched?.name;
      }
    } else if (selectedOfficeId) {
      const off = offices?.find(o => o?.id === selectedOfficeId);
      resolvedOfficeName = off?.name || '';
    } else {
      errors?.push('practice_location is required');
    }

    // Company
    if (!row?.implant_company_name?.trim()) {
      errors?.push('implant_company_name is required');
    } else {
      const compMatch = companies?.find(c => c?.name?.toLowerCase() === row?.implant_company_name?.trim()?.toLowerCase());
      if (!compMatch) {
        if (isSuperAdmin) {
          warnings?.push(`implant_company "${row?.implant_company_name}" not found — will be auto-created`);
          autoCreate?.push({ type: 'company', name: row?.implant_company_name?.trim() });
        } else {
          errors?.push(`implant_company "${row?.implant_company_name}" not found in master data`);
        }
      }
    }

    // Quantity
    if (!row?.quantity_added?.toString()?.trim()) {
      errors?.push('quantity_added is required');
    } else {
      const qty = parseInt(row?.quantity_added, 10);
      if (isNaN(qty) || qty <= 0) errors?.push('quantity_added must be a positive integer');
    }

    // Expiration date
    if (row?.expiration_date?.trim()) {
      if (!/^\d{4}-\d{2}-\d{2}$/?.test(row?.expiration_date?.trim())) {
        errors?.push('expiration_date must be YYYY-MM-DD format');
      } else {
        const expDate = new Date(row.expiration_date.trim());
        if (isNaN(expDate?.getTime())) {
          errors?.push('expiration_date is not a valid date');
        } else if (expDate < new Date()) {
          warnings?.push('expiration_date is already expired');
        }
      }
    }

    // Duplicate ID check
    if (row?.identification_number?.trim() && existingIds?.includes(row?.identification_number?.trim())) {
      if (isSuperAdmin) {
        warnings?.push(`identification_number "${row?.identification_number}" already exists (Super Admin override allowed)`);
      } else {
        errors?.push(`identification_number "${row?.identification_number}" already exists in inventory`);
      }
    }

    // Duplicate within file
    const dupeInFile = rows?.findIndex((r2, i2) => i2 !== idx && r2?.identification_number?.trim() === row?.identification_number?.trim() && row?.identification_number?.trim());
    if (dupeInFile !== -1 && dupeInFile < idx) {
      warnings?.push(`identification_number "${row?.identification_number}" is duplicated within this import file (row ${dupeInFile + 1})`);
    }

    const status = errors?.length > 0 ? 'error' : warnings?.length > 0 ? 'warning' : 'valid';
    return {
      ...row,
      _rowIndex: idx,
      _errors: errors,
      _warnings: warnings,
      _status: status,
      _autoCreate: autoCreate,
      _resolvedOfficeId: resolvedOfficeId,
      _resolvedOfficeName: resolvedOfficeName,
    };
  });
};

// ── Execute bone/tissue import ────────────────────────────────────────────
export const executeBoneTissueImport = async (validRows, batchMeta, userId, userName) => {
  // Create batch record
  const { data: batch, error: batchErr } = await supabase?.from('inventory_import_batches')?.insert({
      import_type: 'bone_tissue',
      office_id: batchMeta?.officeId || null,
      office_name: batchMeta?.officeName || '',
      imported_by: userId,
      imported_by_name: userName,
      source: batchMeta?.source,
      total_rows: batchMeta?.totalRows,
      valid_rows: batchMeta?.validRows,
      warning_rows: batchMeta?.warningRows,
      error_rows: batchMeta?.errorRows,
      skipped_rows: batchMeta?.skippedRows,
      batch_status: 'pending',
    })?.select()?.single();
  if (batchErr) throw batchErr;

  const importedRecordIds = [];
  const importRowInserts = [];

  for (const row of validRows) {
    try {
      const category = BT_CATEGORIES?.find(c => c?.toLowerCase() === row?.category?.trim()?.toLowerCase()) || 'Bone';
      const statusRaw = row?.status?.trim();
      const statusMap = { 'in stock': 'In Stock', 'used': 'Used', 'returned': 'Returned', 'wasted': 'Wasted', 'expired': 'In Stock' };
      const itemStatus = statusMap?.[statusRaw?.toLowerCase()] || 'In Stock';

      const { data: record, error: recErr } = await supabase?.from('bone_tissue_inventory')?.insert({
          office_id: row?._resolvedOfficeId,
          office_name: row?._resolvedOfficeName,
          bone_tissue_type: category,
          product_name: row?.product_name?.trim() || '',
          identification_number: row?.identification_number?.trim() || '',
          lot_number: row?.lot_number?.trim() || '',
          expiration_date: row?.expiration_date?.trim() || null,
          quantity_used: parseInt(row?.quantity_added, 10) || 1,
          item_status: itemStatus,
          procedure_notes: row?.notes?.trim() || '',
          procedure_date: new Date()?.toISOString()?.split('T')?.[0],
          provider_name: '',
          patient_name: '',
          staff_assistant_name: '',
          stock_count: parseInt(row?.quantity_added, 10) || 1,
          created_by: userId,
          updated_by: userId,
          import_batch_id: batch?.id,
        })?.select()?.single();

      if (recErr) throw recErr;
      importedRecordIds?.push(record?.id);

      // Upsert stock
      if (row?._resolvedOfficeId) {
        const { data: existingStock } = await supabase?.from('bone_tissue_stock')?.select('id, current_stock')?.eq('identification_number', row?.identification_number?.trim() || '')?.eq('office_id', row?._resolvedOfficeId)?.maybeSingle();

        const qty = parseInt(row?.quantity_added, 10) || 1;
        if (existingStock) {
          await supabase?.from('bone_tissue_stock')?.update({ current_stock: existingStock?.current_stock + qty, updated_at: new Date()?.toISOString() })?.eq('id', existingStock?.id);
        } else {
          await supabase?.from('bone_tissue_stock')?.insert({
              product_name: row?.product_name?.trim() || '',
              identification_number: row?.identification_number?.trim() || '',
              office_id: row?._resolvedOfficeId,
              office_name: row?._resolvedOfficeName,
              current_stock: qty,
              last_restocked_by: userId,
              last_restocked_by_name: userName,
              last_restocked_at: new Date()?.toISOString(),
            });
        }
      }

      // Movement record
      await supabase?.from('inventory_movements')?.insert({
        record_id: record?.id,
        record_type: 'bone_tissue',
        office_id: row?._resolvedOfficeId,
        office_name: row?._resolvedOfficeName,
        movement_type: 'imported',
        quantity_change: parseInt(row?.quantity_added, 10) || 1,
        notes: `Bulk import via ${batchMeta?.source}`,
        performed_by: userId,
        performed_by_name: userName,
        batch_id: batch?.id,
      });

      importRowInserts?.push({
        batch_id: batch?.id,
        row_number: row?._rowIndex + 1,
        raw_data: row,
        parsed_data: { product_name: row?.product_name, category, office: row?._resolvedOfficeName },
        validation_status: row?._status,
        validation_messages: [...(row?._errors || []), ...(row?._warnings || [])],
        record_id: record?.id,
      });
    } catch (err) {
      importRowInserts?.push({
        batch_id: batch?.id,
        row_number: row?._rowIndex + 1,
        raw_data: row,
        parsed_data: {},
        validation_status: 'error',
        validation_messages: [err?.message],
        record_id: null,
      });
    }
  }

  // Insert import rows
  if (importRowInserts?.length > 0) {
    await supabase?.from('inventory_import_rows')?.insert(importRowInserts);
  }

  // Update batch status
  await supabase?.from('inventory_import_batches')?.update({ batch_status: 'completed', valid_rows: importedRecordIds?.length, updated_at: new Date()?.toISOString() })?.eq('id', batch?.id);

  return { batchId: batch?.id, importedCount: importedRecordIds?.length };
};

// ── Execute implant import ────────────────────────────────────────────────
export const executeImplantImport = async (validRows, batchMeta, userId, userName, companies, systems, platformSizes, lengths, diameters, isSuperAdmin) => {
  const { data: batch, error: batchErr } = await supabase?.from('inventory_import_batches')?.insert({
      import_type: 'implant',
      office_id: batchMeta?.officeId || null,
      office_name: batchMeta?.officeName || '',
      imported_by: userId,
      imported_by_name: userName,
      source: batchMeta?.source,
      total_rows: batchMeta?.totalRows,
      valid_rows: batchMeta?.validRows,
      warning_rows: batchMeta?.warningRows,
      error_rows: batchMeta?.errorRows,
      skipped_rows: batchMeta?.skippedRows,
      batch_status: 'pending',
    })?.select()?.single();
  if (batchErr) throw batchErr;

  const importedRecordIds = [];
  const importRowInserts = [];

  for (const row of validRows) {
    try {
      // Resolve or auto-create company
      let companyId = null;
      let companyName = row?.implant_company_name?.trim() || '';
      const compMatch = companies?.find(c => c?.name?.toLowerCase() === companyName?.toLowerCase());
      if (compMatch) {
        companyId = compMatch?.id;
      } else if (isSuperAdmin && companyName) {
        const { data: newComp } = await supabase?.from('implant_companies')?.insert({ name: companyName, is_active: true, created_by: userId })?.select()?.single();
        companyId = newComp?.id || null;
      }

      // Resolve system
      let systemId = null;
      let systemName = row?.implant_system?.trim() || '';
      if (systemName) {
        const sysMatch = systems?.find(s => s?.name?.toLowerCase() === systemName?.toLowerCase());
        if (sysMatch) {
          systemId = sysMatch?.id;
        } else if (isSuperAdmin) {
          const { data: newSys } = await supabase?.from('implant_systems')?.insert({ name: systemName, company_id: companyId, is_active: true, created_by: userId })?.select()?.single();
          systemId = newSys?.id || null;
        }
      }

      // Resolve platform size
      let platformSizeId = null;
      let platformSizeName = row?.platform_size?.trim() || '';
      if (platformSizeName) {
        const psMatch = platformSizes?.find(p => p?.name?.toLowerCase() === platformSizeName?.toLowerCase());
        if (psMatch) {
          platformSizeId = psMatch?.id;
        } else if (isSuperAdmin) {
          const { data: newPs } = await supabase?.from('implant_platform_sizes')?.insert({ name: platformSizeName, is_active: true, created_by: userId })?.select()?.single();
          platformSizeId = newPs?.id || null;
        }
      }

      // Resolve length
      let lengthId = null;
      let lengthLabel = row?.implant_length?.trim() || '';
      if (lengthLabel) {
        const lenMatch = lengths?.find(l => l?.label?.toLowerCase() === lengthLabel?.toLowerCase());
        if (lenMatch) {
          lengthId = lenMatch?.id;
          lengthLabel = lenMatch?.label;
        } else if (isSuperAdmin) {
          const { data: newLen } = await supabase?.from('implant_lengths')?.insert({ label: lengthLabel, is_active: true, created_by: userId })?.select()?.single();
          lengthId = newLen?.id || null;
        }
      }

      // Resolve diameter
      let diameterId = null;
      let diameterLabel = row?.diameter?.trim() || '';
      if (diameterLabel) {
        const diaMatch = diameters?.find(d => d?.label?.toLowerCase() === diameterLabel?.toLowerCase());
        if (diaMatch) {
          diameterId = diaMatch?.id;
          diameterLabel = diaMatch?.label;
        } else if (isSuperAdmin) {
          const { data: newDia } = await supabase?.from('implant_diameters')?.insert({ label: diameterLabel, is_active: true, created_by: userId })?.select()?.single();
          diameterId = newDia?.id || null;
        }
      }

      const statusRaw = row?.status?.trim()?.toLowerCase();
      const validStatuses = ['in_stock', 'used', 'returned', 'wasted', 'expired'];
      const itemStatus = validStatuses?.includes(statusRaw) ? statusRaw : 'in_stock';

      const { data: record, error: recErr } = await supabase?.from('implant_inventory')?.insert({
          office_id: row?._resolvedOfficeId,
          office_name: row?._resolvedOfficeName,
          company_id: companyId,
          company_name: companyName,
          system_id: systemId,
          system_name: systemName,
          platform_size_id: platformSizeId,
          platform_size_name: platformSizeName,
          length_id: lengthId,
          length_label: lengthLabel,
          diameter_id: diameterId,
          diameter_label: diameterLabel,
          sku_reference: row?.sku_reference?.trim() || '',
          lot_number: row?.lot_number?.trim() || '',
          identification_number: row?.identification_number?.trim() || '',
          expiration_date: row?.expiration_date?.trim() || null,
          quantity_in_stock: parseInt(row?.quantity_added, 10) || 1,
          minimum_stock_level: parseInt(row?.minimum_stock_level, 10) || 2,
          item_status: itemStatus,
          notes: row?.notes?.trim() || '',
          created_by: userId,
          updated_by: userId,
          import_batch_id: batch?.id,
        })?.select()?.single();

      if (recErr) throw recErr;
      importedRecordIds?.push(record?.id);

      // Movement record
      await supabase?.from('inventory_movements')?.insert({
        record_id: record?.id,
        record_type: 'implant',
        office_id: row?._resolvedOfficeId,
        office_name: row?._resolvedOfficeName,
        movement_type: 'imported',
        quantity_change: parseInt(row?.quantity_added, 10) || 1,
        notes: `Bulk import via ${batchMeta?.source}`,
        performed_by: userId,
        performed_by_name: userName,
        batch_id: batch?.id,
      });

      importRowInserts?.push({
        batch_id: batch?.id,
        row_number: row?._rowIndex + 1,
        raw_data: row,
        parsed_data: { company: companyName, system: systemName, office: row?._resolvedOfficeName },
        validation_status: row?._status,
        validation_messages: [...(row?._errors || []), ...(row?._warnings || [])],
        record_id: record?.id,
      });
    } catch (err) {
      importRowInserts?.push({
        batch_id: batch?.id,
        row_number: row?._rowIndex + 1,
        raw_data: row,
        parsed_data: {},
        validation_status: 'error',
        validation_messages: [err?.message],
        record_id: null,
      });
    }
  }

  if (importRowInserts?.length > 0) {
    await supabase?.from('inventory_import_rows')?.insert(importRowInserts);
  }

  await supabase?.from('inventory_import_batches')?.update({ batch_status: 'completed', valid_rows: importedRecordIds?.length, updated_at: new Date()?.toISOString() })?.eq('id', batch?.id);

  return { batchId: batch?.id, importedCount: importedRecordIds?.length };
};

// ── Fetch import batches ──────────────────────────────────────────────────
export const fetchImportBatches = async (filters = {}) => {
  let q = supabase?.from('inventory_import_batches')?.select('*')?.order('imported_at', { ascending: false });

  if (filters?.importType) q = q?.eq('import_type', filters?.importType);
  if (filters?.officeId) q = q?.eq('office_id', filters?.officeId);
  if (filters?.status) q = q?.eq('batch_status', filters?.status);
  if (filters?.dateFrom) q = q?.gte('imported_at', filters?.dateFrom);
  if (filters?.dateTo) q = q?.lte('imported_at', filters?.dateTo);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
};

// ── Fetch import rows for a batch ─────────────────────────────────────────
export const fetchImportRows = async (batchId) => {
  const { data, error } = await supabase?.from('inventory_import_rows')?.select('*')?.eq('batch_id', batchId)?.order('row_number');
  if (error) throw error;
  return data || [];
};

// ── Template generators ───────────────────────────────────────────────────
export const downloadBoneTissueTemplate = (category = 'Bone') => {
  const headers = ['practice_location', 'category', 'product_name', 'brand_manufacturer', 'identification_number', 'lot_number', 'expiration_date', 'quantity_added', 'unit_type', 'status', 'notes'];
  const example = ['Nu Dental of Brick', category, `Sample ${category} Product`, 'BioHorizons', 'ID-2024-001', 'LOT-ABC123', '2027-06-30', '5', 'Unit', 'In Stock', 'Sample notes'];
  const instructions = ['Required: practice_location, category, product_name, quantity_added', '', '', '', '', '', 'Format: YYYY-MM-DD', 'Positive integer', '', 'In Stock/Used/Returned/Wasted/Expired', ''];
  const csv = [headers, instructions, example]?.map(r => r?.join(','))?.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${category}_Inventory_Template.csv`;
  a?.click();
  URL.revokeObjectURL(url);
};

export const downloadImplantTemplate = () => {
  const headers = ['practice_location', 'implant_company_name', 'implant_system', 'platform_size', 'implant_length', 'diameter', 'sku_reference', 'identification_number', 'lot_number', 'expiration_date', 'quantity_added', 'minimum_stock_level', 'status', 'notes'];
  const example = ['Nu Dental of Eatontown', 'Nobel Biocare', 'NobelActive', 'NP', '10mm', '3.5mm', 'SKU-001', 'SN-2024-001', 'LOT-XYZ', '2027-12-31', '3', '2', 'in_stock', 'Sample notes'];
  const instructions = ['Required', 'Required', '', '', '', '', '', '', '', 'Format: YYYY-MM-DD', 'Required positive integer', 'Default: 2', 'in_stock/used/returned/wasted/expired', ''];
  const csv = [headers, instructions, example]?.map(r => r?.join(','))?.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Implant_Inventory_Template.csv';
  a?.click();
  URL.revokeObjectURL(url);
};

export const downloadErrorReport = (rows) => {
  const headers = ['row_number', 'status', 'errors', 'warnings', 'product_name', 'identification_number', 'practice_location'];
  const csvRows = rows?.filter(r => r?._status === 'error' || r?._status === 'warning')?.map(r => [
      r?._rowIndex + 1,
      r?._status,
      (r?._errors || [])?.join('; '),
      (r?._warnings || [])?.join('; '),
      r?.product_name || r?.implant_company_name || '',
      r?.identification_number || '',
      r?.practice_location || r?._resolvedOfficeName || '',
    ]);
  const csv = [headers, ...csvRows]?.map(r => r?.map(v => `"${String(v)?.replace(/"/g, '""')}"`)?.join(','))?.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'import_error_report.csv';
  a?.click();
  URL.revokeObjectURL(url);
};
