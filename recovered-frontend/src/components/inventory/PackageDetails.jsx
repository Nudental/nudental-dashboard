
import React from 'react';
export function packageSize(details={}) {
  return [details.diameter&&'Ø '+details.diameter,details.length&&'Length '+details.length,details.size,
    details.volume&&details.volumeUnit&&details.volume+' '+details.volumeUnit].filter(Boolean).join(' · ')||'—';
}
export default function PackageDetails({details={}}) {
  const fields=[['product','Product / company'],['manufacturer','Manufacturer / tissue bank'],['system','Implant system'],['sku','Reference'],
    ['diameter','Diameter'],['length','Length'],['platform','Platform'],['size','Dimensions'],['particleSize','Particle size'],
    ['surface','Surface'],['collar','Healing collar'],['donor','Donor / tissue ID'],['gtin','GTIN'],['serial','Serial'],
    ['manufactured','Manufactured'],['sterility','Processing']];
  return <details className="text-sm"><summary className="cursor-pointer">Package details</summary><dl className="grid grid-cols-2 gap-2 py-2">
    {fields.filter(([key])=>details[key]).map(([key,label])=><React.Fragment key={key}><dt>{label}</dt><dd>{details[key]}</dd></React.Fragment>)}
    {details.volume&&<><dt>Volume / weight</dt><dd>{details.volume} {details.volumeUnit}</dd></>}
  </dl></details>;
}
