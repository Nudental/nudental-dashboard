// Read-only helpers: never publish a partial set as a complete audit dataset.
export const readCompleteAuditEntries = async (fetchPage, pageSize = 1000) => {
  const rows = [], seen = new Set();
  let expected = null;
  do {
    const result = await fetchPage(rows.length, rows.length + pageSize - 1);
    if (result?.error) throw new Error('Audit entry query failed. Refresh to retry.');
    const count = result?.count, page = result?.data;
    if (!Number.isInteger(count) || count < 0 || count > 50000 || !Array.isArray(page)) {
      throw new Error('Unable to confirm a complete audit dataset. Narrow the office or status filter and retry.');
    }
    if (expected === null) expected = count;
    if (count !== expected || page.length > pageSize || rows.length + page.length > expected) {
      throw new Error('Audit entries changed while loading. Refresh to retry.');
    }
    if (page.length === 0 && rows.length < expected) throw new Error('Audit entry results were incomplete. Refresh to retry.');
    for (const row of page) {
      if (!row?.id || seen.has(row.id)) throw new Error('Audit entry results were duplicated or incomplete. Refresh to retry.');
      seen.add(row.id); rows.push(row);
    }
  } while (rows.length < expected);
  return rows;
};

export const getAuditYearRange = (earliest, latest) => {
  if (!earliest && !latest) return [];
  const year = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value) ? Number(value.slice(0, 4)) : NaN;
  const first = year(earliest), last = year(latest);
  if (!Number.isInteger(first) || !Number.isInteger(last) || first > last || last - first > 100) {
    throw new Error('Available audit years could not be confirmed. Refresh to retry.');
  }
  return Array.from({ length: last - first + 1 }, (_, index) => last - index);
};
