const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../recovered-frontend'),parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser')),s=fs.readFileSync(path.join(root,'src/pages/rcm/components/RcmDashboardTab.jsx'),'utf8'),ast=parser.parse(s,{sourceType:'module',plugins:['jsx']});let card;
function walk(n){if(!n||typeof n!=='object')return;if(n.type==='JSXOpeningElement'&&n.attributes.some(a=>a.name?.name==='label'&&a.value?.value==='Collection %')){assert(!card);card=n}for(const v of Object.values(n))if(v&&typeof v==='object')Array.isArray(v)?v.forEach(walk):walk(v)}walk(ast);assert(card);const expr=k=>{const n=card.attributes.find(a=>a.name?.name===k).value.expression;return s.slice(n.start,n.end)},sub=expr('subLabel'),warning=expr('warning');
function render(mtdProduction,mtdCollections,collectionPct=null){const ctx={mtdProduction,mtdCollections,collectionPct};return {text:vm.runInNewContext(sub,ctx),warning:vm.runInNewContext(warning,ctx)}}
test('zero production and zero collections describe the real denominator',()=>assert.equal(render(0,0).text,'N/A — net production is zero'));
test('known zero denominator does not claim a missing source',()=>assert.equal(render(0,0).warning,undefined));
test('positive collections with zero net still have an undefined ratio',()=>assert.deepEqual(render(0,5),{text:'N/A — net production is zero',warning:undefined}));
test('missing numerator retains the unavailable-data message',()=>assert.match(render(0,null).warning,/field unavailable/));
test('missing denominator retains the unavailable-data message',()=>assert.match(render(null,5).warning,/field unavailable/));
test('valid percentage remains unchanged',()=>assert.deepEqual(render(100,60,60),{text:'Collections ÷ Net Production',warning:undefined}));
