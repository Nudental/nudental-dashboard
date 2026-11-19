
const implantCatalog = {
  // Verified against the manufacturer's 823710U listing and the package label, 2026-11-19.
  // https://www.implantdirect.com/en-us/catalog/implants/internal-hex-connection/simplylegacy2
  '10841307107354': {product:'Implant Direct',system:'simply Legacy2',platform:'3.5 mm',sku:'823710U',diameter:'3.7 mm',length:'10 mm',surface:'SBM',collar:'4.8 × 3 mm',
    catalogLabel:'Implant Direct simply Legacy2 · 3.7 × 10 mm · platform 3.5 mm',catalogSource:'Implant Direct REF 823710U'}
};

export function parsePackage(raw) {
  const code=String(raw).trim().replace(/^\]([dD]2|C1)/,'');
  try {
    const v=JSON.parse(code);
    if(v && typeof v==='object' && !Array.isArray(v)) return {identifier:String(v.id || v.identification_number || ''),lot:String(v.lot || v.lot_number || ''),
      expiry:v.exp || v.expiration_date || '',product:v.name || v.product_name || '',sku:v.sku || v.ref || ''};
  } catch {}
  const values={};let rest=code;
  const gs1=/^\(01\)|^01\d{14}|^\][dD]2/.test(String(raw).trim()) || /^\((10|11|17|21)\)/.test(code);
  while(rest) {
    rest=rest.replace(/^\x1d/,'');
    if(!rest)break;
    const ai=rest.match(/^\((01|10|11|17|21)\)|^(01|10|11|17|21)/);
    if(!ai)break;
    const key=ai[1]||ai[2];rest=rest.slice(ai[0].length);
    const length=key==='01'?14:['11','17'].includes(key)?6:rest.search(/[\x1d(]/);
    const n=length<0?rest.length:length,value=rest.slice(0,n);
    if(values[key] || !value || (['01','11','17'].includes(key) && (value.length!==length || !/^\d+$/.test(value))))break;
    if(['10','21'].includes(key)&&value.length>20)break;
    values[key]=value;rest=rest.slice(n);
  }
  if(!rest && Object.keys(values).length) {
    const gtin=values['01']||'';
    if(gtin && [...gtin].reduce((sum,d,i)=>sum+Number(d)*(i%2===0?3:1),0)%10!==0)throw new Error('The product barcode is incomplete or invalid. Scan the whole square code again.');
    const date=value=>{
      if(!value)return '';
      const year=2000+Number(value.slice(0,2)),month=Number(value.slice(2,4)),last=new Date(Date.UTC(year,month,0)).getUTCDate(),day=Number(value.slice(4))||last;
      if(month<1||month>12||day<1||day>last)throw new Error('The date in this barcode is invalid. Check the package label.');
      return year+'-'+value.slice(2,4)+'-'+String(day).padStart(2,'0');
    };
    return {...(implantCatalog[gtin]||{}),identifier:values['21']||gtin,gtin,serial:values['21']||'',lot:values['10']||'',
      expiry:date(values['17']),manufactured:date(values['11']),codeType:'GS1'};
  }
  if(gs1)throw new Error('This GS1 code is incomplete or has unsupported fields. Rescan, or enter the item ID, lot and expiration from the label.');
  return {identifier:code};
}
