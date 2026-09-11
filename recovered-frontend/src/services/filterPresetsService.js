/**
 * Filter Presets Service
 * Saves/loads named filter combinations to localStorage.
 * Shape: { datePreset, selectedOfficeIds, lineOfBusiness, viewBy }
 */

const STORAGE_KEY = 'nudashboard_filter_presets';

export const filterPresetsService = {
  /** Return all saved presets */
  getAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  /** Save a new preset (or overwrite by name) */
  save(name, filters) {
    const presets = this.getAll();
    const existing = presets?.findIndex(p => p?.name === name);
    const entry = {
      id: existing >= 0 ? presets?.[existing]?.id : `preset_${Date.now()}`,
      name: name?.trim(),
      filters,
      savedAt: new Date()?.toISOString(),
    };
    if (existing >= 0) {
      presets[existing] = entry;
    } else {
      presets?.unshift(entry);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    return entry;
  },

  /** Delete a preset by id */
  delete(id) {
    const presets = this.getAll()?.filter(p => p?.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  },
};
