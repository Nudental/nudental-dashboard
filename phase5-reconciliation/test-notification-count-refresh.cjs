const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../recovered-frontend'),parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const service=fs.readFileSync(path.join(root,'src/services/notificationsService.js'),'utf8'),header=fs.readFileSync(path.join(root,'src/components/layout/Header.jsx'),'utf8');
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r;}}
const serviceTree=parser.parse(service,{sourceType:'module'}),headerTree=parser.parse(header,{sourceType:'module',plugins:['jsx']});
const effect=find(headerTree,n=>n.type==='CallExpression'&&n.callee?.name==='useEffect'&&header.slice(n.start,n.end).includes('getUnreadCount')).arguments[0];
const method=name=>{const n=find(serviceTree,n=>n.type==='ObjectMethod'&&n.key.name===name);return '('+service.slice(n.start,n.end).replace(new RegExp('^(async\\s+)?'+name),'$1function')+')';};
function events(){const listeners=new Map();return {calls:0,addEventListener(k,fn){listeners.set(k,fn);},removeEventListener(k,fn){if(listeners.get(k)===fn)listeners.delete(k);},dispatchEvent(e){this.calls++;listeners.get(e.type)?.();}};}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function headerSetup(){const window=events(),s={count:3,shown:null,callback:null,unsubscribed:false};const notificationsService={getUnreadCount:async()=>s.count,subscribeToNotifications(id,cb){s.callback=cb;return 'qa-channel';},unsubscribe(){s.unsubscribed=true;}};
 s.cleanup=vm.runInNewContext('('+header.slice(effect.start,effect.end)+')',{window,user:{id:'qa-staff'},notificationsService,setUnreadCount(v){s.shown=typeof v==='function'?v(s.shown):v;},console:{error(){}}})();s.window=window;return s;}
test('header reloads the exact unread count after a realtime state change',async()=>{const s=headerSetup();await tick();assert.equal(s.shown,3);s.count=0;s.callback({is_read:true});await tick();assert.equal(s.shown,0);});
test('same-page notification changes refresh the header and cleanup removes the listener',async()=>{const s=headerSetup();await tick();s.count=1;s.window.dispatchEvent({type:'notifications:changed'});await tick();assert.equal(s.shown,1);s.cleanup();s.count=0;s.window.dispatchEvent({type:'notifications:changed'});await tick();assert.equal(s.shown,1);assert.ok(s.unsubscribed);});
test('notification subscription includes read and archive updates',()=>{let subscription;const q={on(event,filter){subscription=filter;return q;},subscribe(){return q;}};vm.runInNewContext(method('subscribeToNotifications'),{supabase:{channel(){return q;}}})('qa-staff',()=>{});assert.equal(subscription.event,'*');assert.equal(subscription.filter,'user_id=eq.qa-staff');});
for(const name of ['markAsRead','markAllAsRead','archiveNotification','archiveAllRead','createNotification'])for(const fail of [false,true])test(name+' '+(fail?'failure does not announce a saved change':'success refreshes shared notification state'),async()=>{
 const window=events(),q={update(){return q;},insert(){return q;},eq(){return q;},then(fn){return Promise.resolve({error:fail?new Error('QA denied'):null}).then(fn);}};
 const supabase={from(){return q;},auth:{getUser:async()=>({data:{user:{id:'qa-staff'}}})}};
 const run=vm.runInNewContext(method(name),{supabase,window,Event,console:{error(){}}});
 const result=await run(name==='createNotification'?{userId:'qa-staff',type:'system',title:'QA TEMP',message:'QA test'}:'qa-notification');assert.equal(result.success,!fail);assert.equal(window.calls,fail?0:1);
});
