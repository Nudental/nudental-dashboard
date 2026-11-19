
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=__dirname,front=path.resolve(root,'..'),deps=path.join(front,'node_modules');
const esbuild=require(path.join(deps,'esbuild'));
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const photo=process.env.IMPLANT_LABEL_PHOTO;
if(!photo)throw new Error('Set IMPLANT_LABEL_PHOTO to a clear photo of the 823710U package barcode.');
const entry=`
import React from 'react';import{createRoot}from'react-dom/client';
import ClinicalOfficeScan from './src/components/inventory/ClinicalOfficeScan.jsx';
import {parsePackage} from './src/components/inventory/packageCode';
import {decodePackage} from './src/components/inventory/packageDecoder';
window.parsePackage=parsePackage;window.decodePackage=decodePackage;
window.calls=[];window.stock=[];window.mode='receive';window.kind='implant';window.details={};
const root=createRoot(document.getElementById('root'));
window.render=()=>root.render(<ClinicalOfficeScan key={Date.now()} kind={window.kind} mode={window.mode} userName="Fixture User"/>);window.render();
`;
(async()=>{
const built=await esbuild.build({stdin:{contents:entry,resolveDir:front,loader:'jsx'},bundle:true,format:'esm',write:false,
plugins:[{name:'fixture-data',setup(build){build.onResolve({filter:/lib\/supabase$/},()=>({path:'supabase',namespace:'fixture'}));
build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export const supabase={rpc:async(name,args)=>{window.calls.push({name,args});await new Promise(r=>setTimeout(r,50));return {data:name==='clinical_scan_offices'?[{id:'office-a',name:'Brick'},{id:'office-b',name:'Barnegat'}]:name==='clinical_scan_stock'?window.stock:name==='clinical_scan_package_details'?window.details:{onHand:1,quantity:1}}}};`}));
}}]});
const server=http.createServer((req,res)=>{
 let body,type='text/html';const u=decodeURIComponent(req.url);
 if(u==='/app.js'){body=built.outputFiles[0].contents;type='text/javascript';}
 else if(u==='/photo.jpg'){body=fs.readFileSync(photo);type='image/jpeg';}
 else if(u.startsWith('/vendor/')){body=fs.readFileSync(path.join(front,'public',u));type=u.endsWith('.wasm')?'application/wasm':'text/javascript';}
 else body='<html><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>';
 res.setHeader('Content-Type',type);res.end(body);
}).listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
const decoded=await page.evaluate(async()=>decodePackage(await(await fetch('/photo.jpg')).blob()));
const info=await page.evaluate(code=>parsePackage(code),decoded);
assert.equal(info.gtin,'10841307107354');assert.equal(info.lot,'15030438');assert.equal(info.expiry,'2030-12-04');assert.equal(info.diameter,'3.7 mm');assert.equal(info.sku,'823710U');
await page.evaluate(()=>{
 const expect=(v,m)=>{if(!v)throw Error(m)};
 expect(parsePackage(']d20110841307107354173012041015030438').lot==='15030438','scanner prefix');
 expect(parsePackage('(01)10841307107354(11)251205(17)301204(10)15030438').manufactured==='2025-12-05','manufacture date');
 expect(parsePackage('01108413071073541015030438\x1d17301204').expiry==='2030-12-04','GS separator');
 expect(parsePackage('OLD-INVENTORY-ID').identifier==='OLD-INVENTORY-ID','manual ID');
 let failed=false;try{parsePackage('(01)10841307107355(17)301204(10)15030438')}catch{failed=true}expect(failed,'check digit');
 failed=false;try{parsePackage('(01)10841307107354(17)301332')}catch{failed=true}expect(failed,'bad date');
});
assert.equal(await page.getByRole('button',{name:'Use camera',exact:true}).count(),0);
await page.getByLabel('Receiving office').selectOption('office-a');
await page.getByLabel('Choose label photo',{exact:true}).setInputFiles(photo);
await page.getByText(/Barcode read/).waitFor();
assert.equal(await page.getByLabel('Diameter (include unit) *',{exact:true}).inputValue(),'3.7 mm');
assert.equal(await page.getByLabel('Length (include unit) *',{exact:true}).inputValue(),'10 mm');
await page.waitForFunction(()=>window.calls.some(c=>c.name==='clinical_scan_stock'));
assert.equal(await page.evaluate(()=>window.calls.filter(c=>c.name==='record_clinical_office_scan_v2').length),0);
assert.equal(await page.getByRole('button',{name:'Receive stock · Brick',exact:true}).isDisabled(),true);
await page.getByLabel('I checked the product',{exact:false}).check();
await page.getByRole('button',{name:'Receive stock · Brick',exact:true}).click();
await page.getByText('Delivery received',{exact:true}).waitFor();
const save=await page.evaluate(()=>window.calls.filter(c=>c.name==='record_clinical_office_scan_v2'));
assert.equal(save.length,1);assert.equal(save[0].args.movement.office,'office-a');assert.equal(save[0].args.movement.length,'10 mm');
await page.evaluate(()=>{window.render();});await page.getByLabel('Receiving office').selectOption('office-b');
await page.evaluate(async()=>{
 const img=new Image();img.src='/photo.jpg';await img.decode();const c=document.createElement('canvas');c.width=1200;c.height=1600;c.getContext('2d').drawImage(img,0,0);
 Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async constraints=>{window.constraints=constraints;window.cameraStream=c.captureStream(5);window.paint=setInterval(()=>c.getContext('2d').drawImage(img,0,0),100);return window.cameraStream}});
});
await page.getByRole('button',{name:'Use camera',exact:true}).click();await page.getByText(/Barcode read/).waitFor({timeout:20000});
assert.equal(await page.getByLabel('Lot number',{exact:true}).inputValue(),'15030438');
await page.waitForFunction(()=>window.cameraStream.getTracks().every(t=>t.readyState==='ended'));
assert.equal(await page.evaluate(()=>window.calls.filter(c=>c.name==='record_clinical_office_scan_v2').length),1);
await page.evaluate(()=>{clearInterval(window.paint);window.kind='graft';window.render()});await page.getByLabel('Receiving office').selectOption('office-a');
await page.getByLabel('Scan or enter package barcode',{exact:true}).fill('BONE-FIXTURE');
await page.getByRole('button',{name:'Read code',exact:true}).click();
for(const [label,value] of [['Product name *','Test Bone'],['Reference / SKU *','TEST-REF'],['Lot number','LOT-BONE'],['Manufacturer / tissue bank *','Test Bank'],['Volume / weight per package','0.5'],['Particle size / range (if printed)','250–1000 µm'],['Donor / tissue ID (if printed)','DONOR-TEST'],['Expiration *','2030-12-04']])await page.getByLabel(label,{exact:true}).fill(value);
await page.getByLabel(/^Material/).selectOption('Bone');await page.getByLabel(/^Volume \/ weight unit/).selectOption('cc');
await page.getByRole('button',{name:'Check stock in Brick',exact:true}).click();
await page.getByLabel('I checked the product',{exact:false}).check();await page.getByRole('button',{name:'Receive stock · Brick',exact:true}).click();await page.getByText('Delivery received',{exact:true}).waitFor();
const graft=await page.evaluate(()=>window.calls.filter(c=>c.name==='record_clinical_office_scan_v2').at(-1));
assert.equal(graft.args.movement.volume,'0.5');assert.equal(graft.args.movement.donor,'DONOR-TEST');assert.equal(errors.length,0,errors.join('\n'));
console.log(JSON.stringify({photo4Decoded:info,officeRequired:true,noAutoSave:true,cameraFrameDecoded:true,cameraStopped:true,implantDimensionsSent:true,graftDetailsSent:true,pageErrors:errors},null,2));
}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
