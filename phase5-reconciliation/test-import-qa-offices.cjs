const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../recovered-frontend'),parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(root,'src/services/bulkImportService.js'),'utf8');
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r;}}
const node=find(parser.parse(source,{sourceType:'module'}),n=>n.type==='VariableDeclarator'&&n.id.name==='fetchOfficesForImport').init;
const production=[{id:'production-id',name:'Production office',color:'blue'}];
function setup(isQa,data=[],error=null){const calls=[];const query={select(v){calls.push(['select',v]);return this;},eq(k,v){calls.push(['eq',k,v]);return this;},order(k){calls.push(['order',k]);return Promise.resolve({data,error});}};return {calls,run:vm.runInNewContext('('+source.slice(node.start,node.end)+')',{dashboardEnvironment:{isQa},OFFICE_LIST:production,supabase:{from(t){calls.push(['from',t]);return query;}}})};}
test('production retains exact central office mapping without database calls',async()=>{const s=setup(false);assert.deepEqual(JSON.parse(JSON.stringify(await s.run())),[{id:'production-id',name:'Production office'}]);assert.equal(s.calls.length,0);});
test('QA imports use scoped active database offices',async()=>{const rows=[{id:'qa-a',name:'QA / Office A'}],s=setup(true,rows);assert.deepEqual(await s.run(),rows);assert.deepEqual(s.calls,[['from','offices'],['select','id, name'],['eq','is_active',true],['order','name']]);});
test('empty QA scope never falls back to production offices',async()=>{const s=setup(true,[]);assert.deepEqual(Array.from(await s.run()),[]);});
test('missing QA rows remain empty',async()=>{const s=setup(true,null);assert.deepEqual(Array.from(await s.run()),[]);});
test('QA permission or network failure propagates without fallback',async()=>{const error=Error('QA denied'),s=setup(true,null,error);await assert.rejects(s.run(),e=>e===error);});
