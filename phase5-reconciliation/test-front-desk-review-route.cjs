const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../recovered-frontend'),runtime=process.env.NDASH_PARSER_ROOT||root;
const parser=require(path.join(runtime,'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(root,'src/config/navConfig.js'),'utf8');
const config=vm.runInNewContext(source.replace(/^export /gm,'')+'\n({NAV_GROUPS,isNavItemVisible});');
const item=config.NAV_GROUPS.flatMap(g=>g.children).find(i=>i.route==='/front-desk-approvals');
const permissions=require('../phase6-hardening/production-permissions.json');
for(const role of permissions.roles)test('Front Desk approval navigation follows actual production role '+role,()=>{
 const grant=p=>permissions.enabled[role].includes(p);
 assert.equal(config.isNavItemVisible(item,{role},grant),['super_admin','admin','regional_manager'].includes(role));
});
test('review navigation does not give Office Manager approval from its page grant',()=>{
 assert.equal(config.isNavItemVisible(item,{role:'office_manager'},()=>true),false);
 assert.equal(config.isNavItemVisible(item,{role:'admin'},()=>false),false);
});
const page=fs.readFileSync(path.join(root,'src/pages/front-desk-approvals/index.jsx'),'utf8');
const ast=parser.parse(page,{sourceType:'module',plugins:['jsx']});
const fn=ast.program.body.find(x=>x.type==='ExportDefaultDeclaration').declaration;
const gate=fn.body.body.find(x=>x.type==='VariableDeclaration'&&x.declarations[0].id.name==='canReview').declarations[0].init;
for(const role of permissions.roles)test('direct review route gate for '+role,()=>{
 const run=enabled=>vm.runInNewContext(page.slice(gate.start,gate.end),{userProfile:{role},hasPermission:()=>enabled});
 assert.equal(run(true),['super_admin','admin','regional_manager'].includes(role));
 assert.equal(run(false),false);
});
test('review-only route mounts existing review UI without catalog or creation interface',()=>{
 assert.match(page,/<FrontDeskRequestReview\s*\/>/);
 assert.doesNotMatch(page,/<FrontDeskInventoryTab|<NewRequest|<InventoryCatalog/);
 assert.ok(page.indexOf('if (loading)')<page.indexOf('const canReview'));
 assert.match(page,/if \(!canReview\) return <AccessDenied/);
 const routes=fs.readFileSync(path.join(root,'src/Routes.jsx'),'utf8');
 assert.match(routes,/<Route path="\/front-desk-approvals" element=\{<FrontDeskApprovals \/>\}/);
});
