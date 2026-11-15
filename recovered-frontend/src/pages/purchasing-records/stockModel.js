const clean = value => String(value ?? '').trim().replace(/\s+/g, ' ');
export const searchable = value => clean(value).toLowerCase().replace(/×/g, 'x').replace(/(\d)\s+mm\b/g, '$1mm');
export const alertCategories = ['Implants', 'Bone & tissue', 'Endo files'];
const endoTerms = /\b(?:endodontic|endo[\s-]*files?|rotary files?|reciprocating files?|k[- ]?files?|h[- ]?files?|hedstrom|protaper|proglider|vortex blue|waveone|reciproc|edgetaper|edgefile|edgeone|edgex7|brasseler endosequence)\b/i;
const mm = value => {
  const label=clean(value).replace(/\s*mm$/i, '').trim();
  return /^\d+(?:\.\d+)?$/.test(label)?String(Number(label)):label;
};
const join = (...parts) => [...new Set(parts.map(clean).filter(Boolean))].join(' ');
function clinicalGroup(row, detail) {
  const item = clean(row.item_name);
  const description = join(item, detail?.brand, detail?.description);
  const brand = clean(detail?.brand || row.category);
  const identified = row.reference || detail?.sku;
  if (row.kind === 'Implants') {
    const dimensions = description.match(/(\d+(?:\.\d+)?)\s*(?:mm)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:mm)?\b/i);
    const diameter = mm(detail?.diameter_label || dimensions?.[1]);
    const length = mm(detail?.length_label || dimensions?.[2]);
    const system = join(brand, item.replace(/\b\d+(?:\.\d+)?\s*(?:mm)?\s*[x×]\s*\d+(?:\.\d+)?\s*(?:mm)?\b/ig, '').trim());
    const size = diameter && length ? diameter + ' mm × ' + length + ' mm' : '';
    const identity = [system, diameter, length, size && system ? '' : identified || row.id];
    return {category:'Implants', title:join(system, size) || 'Implant', identity, threshold:2, sizeUnknown:!size};
  }
  if (row.kind === 'Bone and tissue' || (row.kind === 'Clinical supply' && /\b(?:bone graft|allograft|xenograft|collagen membrane|barrier membrane|graft membrane)\b/i.test(description))) {
    return {category:'Bone & tissue', title:item || 'Bone or tissue', identity:[row.category, item, item && !/^(?:bone|graft|bone graft|membrane|tissue)$/i.test(item) ? '' : identified || row.id], threshold:3};
  }
  const accessory=/\b(?:paper points?|gutta[- ]percha|file holders?|organizers?|file stands?|file boxes)\b/i.test(description);
  if (!accessory && (endoTerms.test(description) || (/\b(?:endo(?:dontics)?|edgeendo)\b/i.test(description) && /\bfiles?\b/i.test(description)))) {
    const withBrand=detail.brand&&!searchable(item).includes(searchable(detail.brand))?join(detail.brand,item):item;
    const raw=join(withBrand,detail.description);
    const formatSize=/\b(\d{1,3})\s*\/\s*(\.?\d{2})\b/i;
    const pair=raw.match(formatSize);
    const tip=raw.match(/\b(?:F[1-5]|S[12X]|X[1-5])\b/i)?.[0]?.toUpperCase() ||
      (pair?'#'+pair[1]:raw.match(/(?:\b(?:size|ISO)\s*#?|#)\s*(\d{1,3})\b/i)?.[1]?.replace(/^/,'#'));
    const taper=pair?'.'+pair[2].replace('.',''):raw.match(/(?:^|[\s/])(\.\d{2})\b/i)?.[1] || (raw.match(/\b([2-9])\s*%/i)?.[1]||'').replace(/^(\d)$/,'.0$1');
    const length=raw.match(/\b(\d+(?:\.\d+)?)\s*mm\b/i)?.[1];
    // Pack counts and trailing catalog references describe ordering, not clinical size.
    const name=withBrand.replace(/\s+(?:—|–)\s+(?:(?:SKU|REF)\s*[:#]?\s*)?[A-Z0-9-]*\d[A-Z0-9-]*\s*$/i,'')
      .replace(/\s*[,;(]?\s*\b(?:\d+\s*[- ]\s*(?:packs?|counts?|pcs?)|(?:box|pack)\s+of\s+\d+|\d+\s*\/\s*(?:box|pack))\b\)?/gi,' ');
    const stem=name.replace(formatSize,' ').replace(/(?:\b(?:size|ISO)\s*#?|#)\s*\d{1,3}\b/gi,' ')
      .replace(/\b(?:F[1-5]|S[12X]|X[1-5])\b/gi,' ').replace(/\b\d+(?:\.\d+)?\s*mm\b/gi,' ')
      .replace(/(?:^|[\s/])\.\d{2}(?:\s*taper)?\b/gi,' ').replace(/\b\d+(?:\.\d+)?\s*%\s*(?:taper)?/gi,' ')
      .replace(/\b(?:pack|box)\s+of\s+\d+\b/gi,' ').replace(/[\s,;/–-]+$/,'').trim();
    const system=clean(stem)||clean(detail.brand);
    const title=join(system,tip,taper?taper+' taper':'',length?length+' mm':'');
    const specific=system&&tip&&length;
    return {category:'Endo files',title:title||withBrand||'Endodontic file',identity:[system,tip,taper,length,specific?'':identified||withBrand||row.id],threshold:3,sizeUnknown:!specific};
  }
  return {category:row.kind || 'Supplies', title:item || 'Unnamed item', identity:[row.category,item,identified || (item ? '' : row.id)], threshold:null};
}
export function groupStock(records, details = new Map()) {
  const groups = new Map();
  for (const row of records) {
    const detail = details.get(row.kind + '/' + row.id) || {};
    const spec = clinicalGroup(row, detail);
    const key = JSON.stringify([row.office_id, spec.category, ...spec.identity.map(searchable)]);
    if (!groups.has(key)) groups.set(key,{...spec,key,office:row.office_name,officeId:row.office_id,quantity:0,unknown:false,lots:[],terms:[]});
    const group = groups.get(key);
    const qty = row.quantity;
    if (qty == null || qty === '' || !Number.isFinite(Number(qty))) group.unknown = true;
    else group.quantity += Number(qty);
    group.lots.push({row,detail});
    group.terms.push(row.item_name,row.category,row.reference,row.lot,detail.vendor,detail.description,detail.identifier,detail.sku,detail.brand,detail.platform_size_name,detail.length_label,detail.diameter_label);
  }
  return [...groups.values()].map(group=>({...group,
    low:!group.unknown && group.threshold !== null && group.quantity < group.threshold,
    search:searchable([group.title, group.category, group.office, ...group.terms].filter(Boolean).join(' ')),
  })).sort((a,b)=>Number(b.low)-Number(a.low) || a.office.localeCompare(b.office) || a.title.localeCompare(b.title));
}
export function visibleStock(groups,{office='',query='',showEmpty=false,onlyLow=false}) {
  const tokens=searchable(query).replace(/\s*[x×]\s*(?=\d)/g,' ').split(/\s+/).filter(Boolean);
  return groups.filter(g=>(!office||g.officeId===office) && (!onlyLow||g.low) &&
    (g.low||showEmpty||g.quantity>0) && tokens.every(token=>g.search.includes(token)));
}
