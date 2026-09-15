const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../recovered-frontend'),parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(root,'src/services/huddleService.js'),'utf8');
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r;}}
const method=find(parser.parse(source,{sourceType:'module'}),n=>n.type==='ObjectMethod'&&n.key.name==='submitHuddle');
const code='('+source.slice(method.start,method.end).replace(/^async\s+submitHuddle/,'async function').replaceAll('import.meta.env','qaEnv')+')';
function setup(status,{denied=false}={}){
 const s={row:{id:'qa-huddle',status,office_id:'qa-office',huddle_date:'2026-09-15',offices:{name:'QA Office'}},writes:0,audit:[],events:[],requests:0};
 const supabase={from(table){
  if(table==='huddle_audit_log'||table==='notification_events')return {async insert(p){(table==='huddle_audit_log'?s.audit:s.events).push(p);return {error:null};}};
  if(table==='user_profiles'){const p={select(){return p;},eq(){return p;},in(){return p;},async maybeSingle(){return {data:{full_name:'QA Manager'}};},then(fn){return Promise.resolve({data:[{email:'qa-admin@nudashboard.example.test'}]}).then(fn);}};return p;}
  assert.equal(table,'huddles');return {update(payload){const filters=[];const q={eq(k,v){filters.push(r=>r[k]===v);return q;},in(k,v){filters.push(r=>v.includes(r[k]));return q;},select(){return q;},async single(){if(denied)return {error:{code:'42501'}};if(!filters.every(f=>f(s.row)))return {error:{code:'PGRST116'}};s.writes++;Object.assign(s.row,payload);return {data:{...s.row},error:null};}};return q;}};
 }};
 s.run=vm.runInNewContext(code,{supabase,qaEnv:{VITE_SUPABASE_URL:'https://qa.invalid',VITE_SUPABASE_ANON_KEY:'qa-placeholder'},fetch:async()=>{s.requests++;return {ok:true};},console:{warn(){}}});return s;
}
for(const status of ['submitted','approved','rejected'])test('stale submission cannot overwrite '+status,async()=>{const s=setup(status);await assert.rejects(()=>s.run('qa-huddle','qa-manager'));assert.equal(s.writes,0);assert.equal(s.row.status,status);assert.equal(s.audit.length,0);assert.equal(s.events.length,0);assert.equal(s.requests,0);});
for(const status of ['draft','unlocked'])test(status+' can still be submitted once',async()=>{const s=setup(status),row=await s.run('qa-huddle','qa-manager');assert.equal(row.status,'submitted');assert.equal(row.submitted_by,'qa-manager');assert.equal(s.writes,1);assert.equal(s.audit.length,1);assert.equal(s.events.length,1);assert.equal(s.requests,1);});
test('simultaneous submissions create one transition and one workflow history entry',async()=>{const s=setup('draft'),r=await Promise.allSettled([s.run('qa-huddle','qa-manager'),s.run('qa-huddle','qa-manager')]);assert.equal(r.filter(v=>v.status==='fulfilled').length,1);assert.equal(s.writes,1);assert.equal(s.audit.length,1);assert.equal(s.events.length,1);assert.equal(s.requests,1);});
test('permission denial produces no submission history or notification request',async()=>{const s=setup('draft',{denied:true});await assert.rejects(()=>s.run('qa-huddle','qa-manager'));assert.equal(s.writes,0);assert.equal(s.audit.length,0);assert.equal(s.requests,0);});
