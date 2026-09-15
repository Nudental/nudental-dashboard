const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const deps=process.env.NDASH_PARSER_ROOT||path.join(__dirname,'../recovered-frontend');
const React=require(path.join(deps,'node_modules/react'));
const {renderToStaticMarkup}=require(path.join(deps,'node_modules/react-dom/server'));
const parser=require(path.join(deps,'node_modules/@babel/parser'));
const esbuild=require(path.join(deps,'node_modules/esbuild'));
const source=fs.readFileSync(path.join(__dirname,'../recovered-frontend/src/components/layout/MainLayout.jsx'),'utf8');
const ast=parser.parse(source,{sourceType:'module',plugins:['jsx']});
const layout=ast.program.body.flatMap(n=>n.type==='VariableDeclaration'?n.declarations:[]).find(n=>n.id.name==='MainLayout').init;
const normalReturn=layout.body.body.filter(n=>n.type==='ReturnStatement').at(-1).argument;
const code=esbuild.transformSync('module.exports='+source.slice(normalReturn.start,normalReturn.end),{loader:'jsx',format:'cjs'}).code;
for(const sidebarWidth of [64,240])test(`Authenticated layout renders one page with sidebar width ${sidebarWidth}`,()=>{
 let pageRenders=0;const blank=()=>null;const module={exports:{}};
 vm.runInNewContext(code,{module,React,sidebarWidth,sidebarCollapsed:sidebarWidth===64,showStaffBanner:false,staffBirthdays:[],dismissStaffBanner:blank,commandPaletteOpen:false,setCommandPaletteOpen:blank,mobileDrawerOpen:false,setMobileDrawerOpen:blank,handleToggleCollapse:blank,showOwnBirthdayModal:false,firstName:'QA',dismissOwnModal:blank,
  OfflineBanner:blank,BirthdayBanner:blank,CommandPalette:blank,Header:blank,Sidebar:blank,MobileQuickActionMenu:blank,BirthdayModal:blank,
  Outlet:()=>{pageRenders++;return React.createElement('section',{'data-qa-route':'true'},'Synthetic page')}
 });
 const html=renderToStaticMarkup(module.exports);
 assert.equal(pageRenders,1,'Hidden responsive copies still execute the route component');
 assert.equal((html.match(/data-qa-route=/g)||[]).length,1);
 assert.ok(html.includes('Synthetic page'));
});
