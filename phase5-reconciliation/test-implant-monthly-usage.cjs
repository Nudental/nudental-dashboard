const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../recovered-frontend'),parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(root,'src/services/implantInventoryService.js'),'utf8');
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r;}}
const node=find(parser.parse(source,{sourceType:'module'}),n=>n.type==='VariableDeclarator'&&n.id.name==='fetchInventorySummary').init;
const code='('+source.slice(node.start,node.end)+')';
function setup({usage=[],inventory=[{item_status:'in_stock',quantity_in_stock:6,minimum_stock_level:2,office_name:'QA / A'}],clock='2026-09-15T16:00:00Z',usageError=false}={}){
 const s={queries:[]};class Clock extends Date{constructor(...a){super(...(a.length?a:[clock]));}}
 const supabase={from(table){const q={table,filters:[]};s.queries.push(q);const query={select(columns,options){q.columns=columns;q.options=options;return query;},eq(k,v){q.filters.push([k,'eq',v]);return query;},gte(k,v){q.filters.push([k,'gte',v]);return query;},lt(k,v){q.filters.push([k,'lt',v]);return query;},then(resolve,reject){assert.ok(['implant_inventory','implant_usage_logs'].includes(table));if(table==='implant_usage_logs'&&usageError)return Promise.resolve({error:{code:'42501'}}).then(resolve,reject);let rows=table==='implant_inventory'?inventory:usage;rows=rows.filter(r=>q.filters.every(([k,op,v])=>op==='eq'?r[k]===v:op==='gte'?r[k]>=v:r[k]<v));return Promise.resolve({data:q.options?.head?null:rows,count:q.options?.count==='exact'?rows.length:null,error:null}).then(resolve,reject);}};return query;}};
 s.run=vm.runInNewContext(code,{supabase,Date:Clock});return s;
}
const used=date=>({item_status:'used',procedure_date:date});
test('a usage of partially stocked inventory counts this month',async()=>{const s=setup({usage:[used('2026-09-15')]});const r=await s.run();assert.equal(r.usedThisMonth,1);assert.equal(r.totalInStock,6);});
test('inventory status is not counted as a dated usage event',async()=>{const s=setup({inventory:[{item_status:'used',quantity_in_stock:0}]});assert.equal((await s.run()).usedThisMonth,0);});
test('month boundaries and usage status exclude unrelated entries',async()=>{const s=setup({usage:[used('2026-08-31'),used('2026-09-01'),used('2026-09-30'),used('2026-10-01'),{item_status:'returned',procedure_date:'2026-09-15'}]});assert.equal((await s.run()).usedThisMonth,2);});
test('December range rolls into next year',async()=>{const s=setup({clock:'2026-12-15T16:00:00Z',usage:[used('2026-12-31'),used('2027-01-01')]});assert.equal((await s.run()).usedThisMonth,1);});
test('count uses authorized rows without requesting patient data',async()=>{const s=setup({usage:[used('2026-09-15')]});assert.equal((await s.run()).usedThisMonth,1);const q=s.queries.find(q=>q.table==='implant_usage_logs');assert.equal(q.columns,'id');assert.equal(q.options.head,true);assert.equal(q.options.count,'exact');assert.deepEqual(q.filters,[['item_status','eq','used'],['procedure_date','gte','2026-09-01'],['procedure_date','lt','2026-10-01']]);});
test('exact count is not limited to a page of usage rows',async()=>{const s=setup({usage:Array.from({length:1501},()=>used('2026-09-15'))});assert.equal((await s.run()).usedThisMonth,1501);});
test('usage query denial is surfaced rather than reported as zero',async()=>{const s=setup({usageError:true});await assert.rejects(s.run,e=>e.code==='42501');});
test('zero authorized usages remains zero and stock is unchanged',async()=>{const r=await setup().run();assert.equal(r.usedThisMonth,0);assert.equal(r.totalInStock,6);assert.equal(r.lowStock,0);});
