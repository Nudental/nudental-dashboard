// Catalog-only verification and exact rollback for reviewed schema groups.
const query={
 functions:"SELECT p.proname AS name,pg_get_function_identity_arguments(p.oid) AS args,pg_get_functiondef(p.oid) AS definition,p.proacl::text AS acl,pg_get_userbyid(p.proowner) AS owner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' ORDER BY p.proname,2",
 policies:"SELECT * FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname",
 triggers:"SELECT c.relname AS table_name,t.tgname AS name,t.tgenabled AS enabled,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname",
 tables:"SELECT c.relname AS name,c.relrowsecurity AS rls,c.relforcerowsecurity AS forced_rls,c.relacl::text AS acl,pg_get_userbyid(c.relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname"
};
const q=s=>'"'+s.replaceAll('"','""')+'"';
async function snapshot(db){const out={};for(const [k,v]of Object.entries(query))out[k]=(await db.query(v)).rows;return out;}
function rollback(before,after){
 const statements=[];const key=(kind,r)=>kind==='functions'?r.name+'('+r.args+')':r.table_name? r.table_name+'.'+r.name:r.tablename+'.'+r.policyname;
 const changed={};for(const kind of ['triggers','policies','functions']){
  const old=new Map(before[kind].map(r=>[key(kind,r),r]));
  changed[kind]=after[kind].filter(r=>JSON.stringify(r)!==JSON.stringify(old.get(key(kind,r)))).map(r=>({after:r,before:old.get(key(kind,r))}));
 }
 for(const {after:r}of changed.triggers)statements.push(`DROP TRIGGER IF EXISTS ${q(r.name)} ON public.${q(r.table_name)};`);
 for(const {after:r}of changed.policies)statements.push(`DROP POLICY IF EXISTS ${q(r.policyname)} ON public.${q(r.tablename)};`);
 for(const {after:r,before:b}of [...changed.functions].reverse())if(!b)statements.push(`DROP FUNCTION IF EXISTS public.${q(r.name)}(${r.args});`);
 for(const {before:b}of changed.functions)if(b)statements.push(b.definition+';');
 for(const {before:b}of changed.policies)if(b)statements.push(`CREATE POLICY ${q(b.policyname)} ON public.${q(b.tablename)} AS ${b.permissive} FOR ${b.cmd} TO ${b.roles.map(x=>x==='public'?'PUBLIC':q(x)).join(',')} ${b.qual?'USING ('+b.qual+')':''} ${b.with_check?'WITH CHECK ('+b.with_check+')':''};`);
 for(const {before:b}of changed.triggers)if(b){statements.push(b.definition+';');if(b.enabled!=='O')statements.push(`ALTER TABLE public.${q(b.table_name)} ${b.enabled==='D'?'DISABLE':b.enabled==='A'?'ENABLE ALWAYS':'ENABLE REPLICA'} TRIGGER ${q(b.name)};`);}
 return 'BEGIN;\nSET LOCAL lock_timeout=\'5s\';\n'+statements.join('\n')+'\nCOMMIT;\n';
}
module.exports={snapshot,rollback,query};
