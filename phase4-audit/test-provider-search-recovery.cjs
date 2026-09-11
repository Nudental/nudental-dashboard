const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../recovered-frontend'),deps=process.env.NDASH_PARSER_ROOT||root;
const parser=require(path.join(deps,'node_modules/@babel/parser')),esbuild=require(path.join(deps,'node_modules/esbuild'));
const React=require(path.join(deps,'node_modules/react')), {renderToStaticMarkup}=require(path.join(deps,'node_modules/react-dom/server'));
const source=fs.readFileSync(path.join(root,'src/pages/kpis/components/ProvidersTab.jsx'),'utf8');
const ast=parser.parse(source,{sourceType:'module',plugins:['jsx']});
const expression=name=>{for(const node of ast.program.body){if(node.type==='VariableDeclaration'){const d=node.declarations.find(d=>d.id.name===name);if(d)return source.slice(d.init.start,d.init.end);}}throw Error(name);};
const compiled=esbuild.transformSync('globalThis.Table = '+expression('ProvidersHeatmapTable'),{loader:'jsx',jsx:'transform',target:'es2020'}).code;
const rows=[{providerId:'qa-1',providerName:'QA Alpha',officeName:'QA North'},{providerId:'qa-2',providerName:'QA Beta',officeName:'QA South'}];
const columns=[{key:'officeName',label:'Location',noColor:true},{key:'providerName',label:'Provider',noColor:true}];
function render(search,data=rows){const context={React,Search:()=>null,Download:()=>null,useState:()=>[search,()=>{}],useMemo:fn=>fn(),calcPercentileRanks:vm.runInNewContext(expression('calcPercentileRanks')),getCellStyle:vm.runInNewContext(expression('getCellStyle'))};vm.runInNewContext(compiled,context);return renderToStaticMarkup(context.Table({rows:data,columns,loading:false}));}
test('unmatched search keeps the input so the user can recover',()=>{const html=render('__QA_NO_MATCH__');assert.ok(html.includes('placeholder="Search provider or location..."'));assert.ok(!html.includes('QA Alpha'));assert.ok(!html.includes('QA Beta'));});
test('clearing an unmatched search restores provider rows',()=>{render('__QA_NO_MATCH__');const html=render('');assert.ok(html.includes('QA Alpha'));assert.ok(html.includes('QA Beta'));});
test('case-insensitive provider and location searches remain scoped',()=>{const name=render('alpha');assert.ok(name.includes('QA Alpha'));assert.ok(!name.includes('QA Beta'));const office=render('south');assert.ok(office.includes('QA Beta'));assert.ok(!office.includes('QA Alpha'));});
test('upstream empty dataset retains its existing period-empty message',()=>{assert.ok(render('',[]).includes('No provider data found for the selected period.'));});
test('whitespace query behaves as an empty search',()=>{const html=render('   ');assert.ok(html.includes('QA Alpha'));assert.ok(html.includes('QA Beta'));});
