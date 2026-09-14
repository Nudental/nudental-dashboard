// Offline PostgreSQL semantics only; never contacts Supabase or a provider.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=__dirname;
const {createRequire}=require('node:module');
const qaRequire=process.env.NDASH_QA_SQL_TOOLS_DIR ? createRequire(path.join(process.env.NDASH_QA_SQL_TOOLS_DIR,'package.json')) : require;
const {PGlite}=qaRequire('@electric-sql/pglite');
const {pg_trgm}=qaRequire('@electric-sql/pglite/contrib/pg_trgm');
const {pgcrypto}=qaRequire('@electric-sql/pglite/contrib/pgcrypto');
const {uuid_ossp}=qaRequire('@electric-sql/pglite/contrib/uuid_ossp');
const sql=fs.readFileSync(path.join(root,'schema.sql'),'utf8');
let stage='initialization';
async function openSchema(){
 const db=new PGlite({extensions:{pg_trgm,pgcrypto,uuid_ossp}});
 try{
  const version=(await db.query('select version()')).rows[0].version;
  stage='synthetic auth bootstrap';
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE ROLE supabase_admin NOLOGIN;
    CREATE SCHEMA extensions;
    CREATE SCHEMA auth;
    GRANT USAGE ON SCHEMA public,auth,extensions TO anon,authenticated,service_role;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}'::jsonb, encrypted_password text, updated_at timestamptz);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.role',true),'')$$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    CREATE FUNCTION auth.email() RETURNS text LANGUAGE sql STABLE AS $$SELECT auth.jwt()->>'email'$$;
  `);
  stage='candidate schema execution';
  await db.exec(sql);
  stage='catalog readback';
  const counts=(await db.query(`SELECT
    (SELECT count(*)::int FROM pg_tables WHERE schemaname='public') AS tables,
    (SELECT count(*)::int FROM pg_policies WHERE schemaname='public') AS policies,
    (SELECT count(*)::int FROM pg_views WHERE schemaname='public') AS views,
    (SELECT count(*)::int FROM pg_matviews WHERE schemaname='public') AS materialized_views
  `)).rows[0];
  const report={status:'PASS',engine:version,method:'In-memory PostgreSQL with minimal synthetic auth schema; no Supabase Auth/PostgREST service',schemaSha256:crypto.createHash('sha256').update(sql).digest('hex'),counts,productionConnected:false,businessRowsCopied:false};
  if(require.main===module)console.log(JSON.stringify(report));
  return {db,report};
 }catch(error){
  const report={status:'FAIL',stage,code:error.code||null,message:String(error.message).slice(0,220),position:error.position||null,productionConnected:false};
  await db.close();throw Object.assign(new Error(report.message),{code:report.code,stage});
 }
}
module.exports={openSchema};
if(require.main===module)openSchema().then(({db})=>db.close()).catch(error=>{console.log(JSON.stringify({status:'FAIL',stage:error.stage||stage,code:error.code||null,message:String(error.message).slice(0,180)}));process.exitCode=1;});
