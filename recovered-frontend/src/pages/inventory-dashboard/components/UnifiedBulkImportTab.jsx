import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import { useAuth } from '../../../contexts/AuthContext';
import ImportHistoryTab from '../../bone-and-tissue-inventory/components/ImportHistoryTab';
import BulkImportWizard from '../../bone-and-tissue-inventory/components/BulkImportWizard';
import ImplantBulkImportWizard from '../../implant-inventory-management/components/ImplantBulkImportWizard';



const UnifiedBulkImportTab = () => {
  const { userProfile, user } = useAuth();
  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isAdmin = userProfile?.role === 'admin' || isSuperAdmin;

  const [importType, setImportType] = useState('bone_tissue');
  const [activeSection, setActiveSection] = useState('import'); // 'import' | 'history'
  const [showBTWizard, setShowBTWizard] = useState(false);
  const [showImplantWizard, setShowImplantWizard] = useState(false);
  const [BulkImportWizard, setBulkImportWizard] = useState(null);
  const [ImplantBulkImportWizard, setImplantBulkImportWizard] = useState(null);
  const [implantMasterData, setImplantMasterData] = useState({ companies: [], systems: [], platformSizes: [], lengths: [], diameters: [] });

  useEffect(() => {
    import('../../bone-and-tissue-inventory/components/BulkImportWizard')?.then(m => setBulkImportWizard(() => m?.default));
    import('../../implant-inventory-management/components/ImplantBulkImportWizard')?.then(m => setImplantBulkImportWizard(() => m?.default));
  }, []);

  useEffect(() => {
    if (importType === 'implant') {
      import('../../../services/implantInventoryService')?.then(async svc => {
        try {
          const [co, sy, ps, ln, dm] = await Promise.all([
            svc?.fetchCompanies(), svc?.fetchSystems(), svc?.fetchPlatformSizes(), svc?.fetchLengths(), svc?.fetchDiameters(),
          ]);
          setImplantMasterData({ companies: co, systems: sy, platformSizes: ps, lengths: ln, diameters: dm });
        } catch (err) { console.error(err); }
      });
    }
  }, [importType]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-foreground">Bulk Import</h2>
        <p className="text-sm text-muted-foreground">Import bone, tissue, membrane, PRF, or implant inventory in bulk. All records are location-specific.</p>
      </div>

      {/* Section toggle */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setActiveSection('import')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            activeSection === 'import' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="flex items-center gap-2"><Icon name="Upload" size={14} />Import</span>
        </button>
        <button
          onClick={() => setActiveSection('history')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            activeSection === 'history' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="flex items-center gap-2"><Icon name="History" size={14} />Import History</span>
        </button>
      </div>

      {activeSection === 'import' && (
        <div className="space-y-5">
          {/* Type selector */}
          <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-xl border border-border">
            <span className="text-sm font-semibold text-foreground">Import Type:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setImportType('bone_tissue')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  importType === 'bone_tissue' ?'bg-emerald-600 text-white shadow-sm' :'bg-background border border-border text-foreground hover:bg-muted/50'
                }`}
              >
                <Icon name="Package" size={14} />
                Bone / Tissue
              </button>
              <button
                onClick={() => setImportType('implant')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  importType === 'implant' ?'bg-blue-600 text-white shadow-sm' :'bg-background border border-border text-foreground hover:bg-muted/50'
                }`}
              >
                <Icon name="Syringe" size={14} />
                Implant
              </button>
            </div>
          </div>

          {/* Bone/Tissue import cards */}
          {importType === 'bone_tissue' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {['Bone', 'Tissue', 'Membrane', 'PRF']?.map(cat => (
                  <div key={cat} className="border border-border rounded-2xl p-5 hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center mb-3">
                      <Icon name="Package" size={20} className="text-emerald-600" />
                    </div>
                    <h3 className="text-sm font-bold text-foreground mb-1">{cat} Inventory</h3>
                    <p className="text-xs text-muted-foreground mb-4">Bulk import {cat?.toLowerCase()} inventory items with location assignment and validation.</p>
                    <button
                      onClick={() => setShowBTWizard(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors"
                    >
                      <Icon name="Upload" size={14} />Import {cat}
                    </button>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-muted/50 rounded-xl border border-border">
                <h3 className="text-sm font-semibold text-foreground mb-2">Import Requirements</h3>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li className="flex items-start gap-2"><Icon name="CheckCircle" size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" />Every row must include or be assigned a Practice Location (one of the 4 Nu Dental offices)</li>
                  <li className="flex items-start gap-2"><Icon name="CheckCircle" size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" />Required fields: Category, Product Name, Quantity Added</li>
                  <li className="flex items-start gap-2"><Icon name="CheckCircle" size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" />Expiration dates must be in YYYY-MM-DD format</li>
                  <li className="flex items-start gap-2"><Icon name="CheckCircle" size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" />Duplicate identification numbers will be flagged — Super Admin can override</li>
                </ul>
              </div>
            </div>
          )}

          {/* Implant import card */}
          {importType === 'implant' && (
            <div className="space-y-4">
              <div className="border border-border rounded-2xl p-6 hover:border-blue-300 hover:bg-blue-50/50 transition-colors max-w-sm">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
                  <Icon name="Syringe" size={20} className="text-blue-600" />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1">Implant Inventory</h3>
                <p className="text-xs text-muted-foreground mb-4">Bulk import implant inventory with company, system, platform size, length, diameter, and location assignment.</p>
                <button
                  onClick={() => setShowImplantWizard(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
                >
                  <Icon name="Upload" size={14} />Import Implants
                </button>
              </div>
              <div className="p-4 bg-muted/50 rounded-xl border border-border">
                <h3 className="text-sm font-semibold text-foreground mb-2">Import Requirements</h3>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li className="flex items-start gap-2"><Icon name="CheckCircle" size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" />Every row must include or be assigned a Practice Location</li>
                  <li className="flex items-start gap-2"><Icon name="CheckCircle" size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" />Required fields: Implant Company Name, Quantity Added</li>
                  <li className="flex items-start gap-2"><Icon name="CheckCircle" size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" />Expiration dates must be in YYYY-MM-DD format</li>
                  <li className="flex items-start gap-2"><Icon name="CheckCircle" size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" />Super Admin can auto-create new companies, systems, sizes, lengths, and diameters during import</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {activeSection === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-xl border border-border">
            <span className="text-sm font-semibold text-foreground">Show history for:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setImportType('bone_tissue')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  importType === 'bone_tissue' ? 'bg-emerald-600 text-white' : 'bg-background border border-border text-foreground hover:bg-muted/50'
                }`}
              >
                <Icon name="Package" size={12} />Bone / Tissue
              </button>
              <button
                onClick={() => setImportType('implant')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  importType === 'implant' ? 'bg-blue-600 text-white' : 'bg-background border border-border text-foreground hover:bg-muted/50'
                }`}
              >
                <Icon name="Syringe" size={12} />Implant
              </button>
            </div>
          </div>
          <ImportHistoryTab importType={importType} />
        </div>
      )}

      {/* Wizards */}
      {showBTWizard && BulkImportWizard && (
        <BulkImportWizard
          onClose={() => setShowBTWizard(false)}
          onImportComplete={() => setShowBTWizard(false)}
        />
      )}
      {showImplantWizard && ImplantBulkImportWizard && (
        <ImplantBulkImportWizard
          onClose={() => setShowImplantWizard(false)}
          onImportComplete={() => setShowImplantWizard(false)}
          companies={implantMasterData?.companies}
          systems={implantMasterData?.systems}
          platformSizes={implantMasterData?.platformSizes}
          lengths={implantMasterData?.lengths}
          diameters={implantMasterData?.diameters}
        />
      )}
    </div>
  );
};

export default UnifiedBulkImportTab;
