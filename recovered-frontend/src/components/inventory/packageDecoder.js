
const readerPath='/vendor/zxing-wasm-3.1.7/reader.js';
let readerPromise;
export function loadPackageReader() {
  if(!readerPromise)readerPromise=import(/* @vite-ignore */ readerPath).then(async reader=>{
    await reader.prepareZXingModule({overrides:{locateFile:()=>'/vendor/zxing-wasm-3.1.7/zxing_reader.wasm'},fireImmediately:true});
    return reader;
  }).catch(error=>{readerPromise=undefined;throw error;});
  return readerPromise;
}
export async function decodePackage(input) {
  const reader=await loadPackageReader();
  const codes=await reader.readBarcodes(input,{formats:['DataMatrix','QRCode','Code128','Code39','EAN13','EAN8','UPCA','UPCE','PDF417'],
    textMode:'Plain',tryHarder:true,tryRotate:true,tryInvert:true,returnErrors:false,maxNumberOfSymbols:8});
  const unique=[...new Set(codes.filter(c=>!c.error).map(c=>c.text).filter(Boolean))];
  if(unique.length>1)throw new Error('More than one barcode is visible. Show only the code on one package.');
  return unique[0]||null;
}
