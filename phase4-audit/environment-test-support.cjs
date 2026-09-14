// Supply the app's real production default to isolated legacy service harnesses.
// No network/client initialization or secret configuration is loaded.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function productionApiOrigin(){
  const root=process.env.NDASH_SOURCE_ROOT||path.resolve(__dirname,'../recovered-frontend');
  const code=fs.readFileSync(path.join(root,'src/config/environmentPolicy.js'),'utf8').replace(/^export /gm,'');
  return vm.runInNewContext(code+'\nresolveDashboardEnvironment({}, "").apiOrigin;',{URL});
}
module.exports={productionApiOrigin};
