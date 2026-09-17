const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../recovered-frontend'),deps=process.env.NDASH_PARSER_ROOT||root;
const parser=require(path.join(deps,'node_modules/@babel/parser')),esbuild=require(path.join(deps,'node_modules/esbuild'));
const source=fs.readFileSync(path.join(root,'src/pages/inventory-dashboard/components/supply/SupplyCatalogTab.jsx'),'utf8');
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r;}}
const node=find(parser.parse(source,{sourceType:'module',plugins:['jsx']}),n=>n.type==='VariableDeclarator'&&n.id.name==='SupplyCatalogTab').init;
const code=esbuild.transformSync('const Component='+source.slice(node.start,node.end)+'; Component;',{loader:'jsx',jsxFactory:'React.createElement'}).code;
const offices=[{id:'uuid-a',name:'QA / Office A'},{id:'uuid-b',name:'QA / Office B'}];
function render(profile,options={}){return vm.runInNewContext(code,{React:{createElement:(type,props)=>({type,props})},useIsMobile:()=>options.mobile!==false,useAuth:()=>({userProfile:profile}),useOffice:()=>({offices:options.offices===undefined?offices:options.offices}),MobileCatalogView:'MobileCatalogView',DesktopCatalogView:'DesktopCatalogView'})({isAdmin:options.isAdmin||false})}
test('mobile stock reads/writes receive the assigned office name instead of its UUID',()=>{assert.equal(render({office_id:'uuid-a'}).props.officeId,'QA / Office A')});
test('another assigned office resolves independently of array order',()=>{assert.equal(render({office_id:'uuid-b'}).props.officeId,'QA / Office B')});
test('production office mapping preserves its existing database name',()=>{assert.equal(render({office_id:'uuid-prod'},{offices:[{id:'uuid-prod',name:'Nu Dental of Eatontown'}]}).props.officeId,'Nu Dental of Eatontown')});
test('unassigned profile never falls back to the first available office',()=>{for(const profile of [null,{}, {office_id:null}])assert.equal(render(profile).props.officeId,null)});
test('an inaccessible or unresolved office never passes a UUID as an office name',()=>{assert.equal(render({office_id:'unknown'}).props.officeId,null);assert.equal(render({office_id:'uuid-a'},{offices:[]}).props.officeId,null)});
test('desktop catalog and admin flag are unchanged',()=>{const desktop=render({office_id:'uuid-a'},{mobile:false,isAdmin:true});assert.equal(desktop.type,'DesktopCatalogView');assert.equal(desktop.props.isAdmin,true);assert.equal(desktop.props.officeId,undefined);assert.equal(render({office_id:'uuid-a'},{isAdmin:true}).props.isAdmin,true)});
