const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const frontend=path.join(__dirname,'../recovered-frontend');
const {createClient}=require(path.join(frontend,'node_modules/@supabase/supabase-js'));
const parser=require(path.join(frontend,'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(frontend,'src/services/managementService.js'),'utf8');
const library=fs.readFileSync(path.join(frontend,'src/lib/supabase.js'),'utf8');
const declaration=parser.parse(source,{sourceType:'module'}).program.body.find(n=>n.type==='ExportNamedDeclaration'&&n.declaration?.declarations?.some(d=>d.id.name==='usersService')).declaration.declarations[0];
const inviteNode=declaration.init.properties.find(p=>p.key.name==='invite');
const inviteSource='({'+source.slice(inviteNode.start,inviteNode.end)+'}).invite';
const admin='00000000-0000-4000-8000-000000000001',invited='00000000-0000-4000-8000-000000000002';
function session(id){const b=v=>Buffer.from(JSON.stringify(v)).toString('base64url');return {access_token:b({alg:'HS256',typ:'JWT'})+'.'+b({sub:id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.synthetic-test-signature',refresh_token:'synthetic-refresh-'+id,token_type:'bearer',expires_in:3600,user:{id,email:'qa-fixture@nudashboard.example.test',aud:'authenticated'}};}
async function setup({confirmEmail=false,failSignup=false}={}){
 const clients=[],calls=[],writes=[];
 const offlineFetch=async(url,options={})=>{
  const pathname=new URL(url).pathname;calls.push(pathname);
  if(pathname.endsWith('/token'))return Response.json(session(admin));
  if(pathname.endsWith('/signup'))return failSignup?Response.json({msg:'Synthetic signup rejection',code:'fixture_error'},{status:400}):Response.json(confirmEmail?{user:session(invited).user}:session(invited));
  throw new Error('Unexpected network operation in offline signup test');
 };
 const clientFactory=(url,key,options)=>{const c=createClient(url,key,{...options,global:{fetch:offlineFetch}});clients.push(c);return c;};
 const libContext={createClient:clientFactory,dashboardEnvironment:{supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co'}};
 // The real app module chooses the same validated environment; replace only the
 // Vite compile-time input with a noncredential fixture for this isolated test.
 const lib=vm.runInNewContext(library.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'').replace('import.meta.env?.VITE_SUPABASE_ANON_KEY',"'synthetic-anon-key'")+'\n({supabase,createUserInvitationClient:typeof createUserInvitationClient===\'function\'?createUserInvitationClient:undefined});',libContext);
 const primary=lib.supabase;
 // Disable real persistence/background timers in the Node-only fixture. The SDK
 // still exercises its real signUp session-save behavior.
 primary.auth.stopAutoRefresh();
 await primary.auth.signInWithPassword({email:'qa-admin@nudashboard.example.test',password:'Synthetic-only-password'});
 primary.from=()=>{
  let payload;
  const chain={select(){return chain;},ilike(){return chain;},maybeSingle:async()=>({data:null,error:null}),
   upsert(value){payload=value;return chain;},single:async()=>{const actor=(await primary.auth.getSession()).data.session?.user?.id;writes.push({actor,payload});return actor===admin?{data:{...payload,id:invited},error:null}:{data:null,error:new Error('Profile access requires the administrator session')};}};
  return chain;
 };
 const invite=vm.runInNewContext(inviteSource,{supabase:primary,createUserInvitationClient:lib.createUserInvitationClient,
  window:{location:{origin:'https://nudashboard-qa.pages.dev'}},logAudit:async()=>{},crypto:require('node:crypto').webcrypto});
 return {invite,primary,writes,calls,clients,close:async()=>{for(const c of clients)c.auth.stopAutoRefresh();}};
}
const payload={email:'qa-invited@nudashboard.example.test',fullName:'QA / Invited User',role:'staff',tempPassword:'Synthetic-only-password',username:'qa-invited'};

test('User invitation retains administrator session for the privileged profile write',async()=>{
 const context=await setup();try{
  await context.invite(payload);
  assert.equal((await context.primary.auth.getSession()).data.session.user.id,admin);
  assert.equal(context.writes.length,1);assert.equal(context.writes[0].actor,admin);
 }finally{await context.close();}
});
test('Invitation still works when signup requires email confirmation',async()=>{
 const context=await setup({confirmEmail:true});try{
  await context.invite(payload);
  assert.equal((await context.primary.auth.getSession()).data.session.user.id,admin);
  assert.equal(context.writes[0].actor,admin);
 }finally{await context.close();}
});
test('Signup failure leaves the administrator session and profile records unchanged',async()=>{
 const context=await setup({failSignup:true});try{
  await assert.rejects(()=>context.invite(payload));
  assert.equal((await context.primary.auth.getSession()).data.session.user.id,admin);
  assert.equal(context.writes.length,0);
 }finally{await context.close();}
});
