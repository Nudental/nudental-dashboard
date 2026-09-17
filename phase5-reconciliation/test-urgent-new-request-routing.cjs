const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../recovered-frontend'),parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(root,'src/pages/inventory-dashboard/components/supply/UrgentRequestTab.jsx'),'utf8');
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r;}}
const ast=parser.parse(source,{sourceType:'module',plugins:['jsx']});
const button=find(ast,n=>n.type==='JSXElement'&&n.openingElement.name.name==='button'&&n.children.some(c=>c.type==='JSXText'&&c.value.includes('New Urgent Request')));
const click=button.openingElement.attributes.find(a=>a.name?.name==='onClick').value.expression;
for(const mobile of [true,false])test('new request opens item selection on '+(mobile?'mobile':'desktop'),()=>{const calls=[];vm.runInNewContext('('+source.slice(click.start,click.end)+')',{isMobile:mobile,setView:v=>calls.push(['view',v]),setMobilePrefill:v=>calls.push(['prefill',v]),setShowMobileModal:v=>calls.push(['modal',v])})();assert.deepEqual(calls,[['view','form']])});
const effect=find(ast,n=>n.type==='CallExpression'&&n.callee.name==='useEffect'&&source.slice(n.arguments[0]?.start,n.arguments[0]?.end).includes('if (prefillItem)')).arguments[0];
test('an existing inventory item still opens the prefilled mobile receipt-style wizard',()=>{const item={item_name:'QA TEMP',office_id:'QA / Office A'},calls=[];vm.runInNewContext('('+source.slice(effect.start,effect.end)+')',{prefillItem:item,isMobile:true,setMobilePrefill:v=>calls.push(['prefill',v]),setShowMobileModal:v=>calls.push(['modal',v])})();assert.deepEqual(calls,[['prefill',item],['modal',true]])});
test('no inventory prefill does not automatically open a blank wizard',()=>{const calls=[];vm.runInNewContext('('+source.slice(effect.start,effect.end)+')',{prefillItem:null,isMobile:true,setMobilePrefill:v=>calls.push(v),setShowMobileModal:v=>calls.push(v)})();assert.deepEqual(calls,[])});
