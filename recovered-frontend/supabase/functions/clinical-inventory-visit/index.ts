// Exact, read-only Ascend lookup. The browser receives only visits at an authorized office.
const locations: Record<string,string> = {
  "54626997-57c2-4934-8743-1dabb4d176f4":"14000000000435",
  "220372a5-afae-49c9-8a0c-f4c0717ff352":"14000000000433",
  "b0abcc46-55e8-4529-a28f-eedf41c1d72e":"14000000000432",
  "1c719b5b-fd77-4da8-a1b9-2209f1cea63e":"14000000000434",
};
const headers = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS","Cache-Control":"no-store","Content-Type":"application/json"};
const reply = (status:number, body:unknown) => new Response(JSON.stringify(body),{status,headers});
const env = (k:string) => { const v=Deno.env.get(k); if(!v) throw new Error("configuration"); return v; };
const normalized=(s:unknown)=>String(s??"").normalize("NFKC").trim().replace(/\s+/g," ").toLocaleLowerCase("en-US");
const refId=(obj:any)=>String(obj?.id??obj??"");
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
function localDay(value:string) {
  const time=new Date(value);
  if(!Number.isFinite(time.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(time);
}
async function fetchJSON(url:string,init:RequestInit={}) {
  const response=await fetch(url,{...init,signal:AbortSignal.timeout(14000)});
  if(!response.ok) throw new Error("upstream");
  return response.json();
}
Deno.serve(async req=>{
  if(req.method==="OPTIONS") return new Response(null,{headers,status:204});
  if(req.method!=="POST") return reply(405,{message:"Use POST."});
  const auth=req.headers.get("Authorization");
  if(!auth?.startsWith("Bearer ")) return reply(401,{message:"Sign in to the portal."});
  try {
    const base=env("SUPABASE_URL"), apikey=env("SUPABASE_ANON_KEY");
    const staffHeaders={apikey,Authorization:auth,"Content-Type":"application/json"};
    const userResponse=await fetch(base+"/auth/v1/user",{headers:staffHeaders});
    if(!userResponse.ok) return reply(401,{message:"Sign in to the portal again."});
    const user=await userResponse.json();
    const body=await req.json().catch(()=>({}));
    const {office,first,last,dob,date}=body;
    if(!locations[office] || ![first,last].every(s=>typeof s==="string" && s.trim() && s.length<=80)
      || !datePattern.test(dob) || !datePattern.test(date) || date>localDay(new Date().toISOString()) || dob>date)
      return reply(400,{message:"Check the office, name, date of birth and visit date."});
    const offices=await fetchJSON(base+"/rest/v1/rpc/clinical_scan_offices",{method:"POST",headers:staffHeaders,body:"{}"});
    if(!offices.some((o:any)=>o.id===office)) return reply(403,{message:"This office is outside your scan assignment."});
    const oauth=await fetchJSON(env("DENTRIX_OAUTH_URL"),{method:"POST",body:new URLSearchParams({
      client_id:env("DENTRIX_CLIENT_ID"),client_secret:env("DENTRIX_CLIENT_SECRET"),grant_type:"client_credentials"})});
    if(!oauth.access_token) throw new Error("upstream");
    const upstreamHeaders={Authorization:"Bearer "+oauth.access_token,"Organization-ID":env("DENTRIX_ORG_ID"),Accept:"application/json"};
    async function read(path:string,params:Record<string,string>) {
      const url=new URL(env("DENTRIX_API_BASE").replace(/\/$/,"")+"/v1/"+path);
      url.search=new URLSearchParams(params).toString();
      const result=await fetchJSON(url.href,{headers:upstreamHeaders});
      return result.data;
    }
    // DOB is validated. Names are compared locally, never interpolated into filter syntax.
    const patients=await read("patients",{filter:"dateOfBirth=="+dob,pageSize:"100",responseFields:"id,firstName,lastName,dateOfBirth,chartNumber,duplicateOfPatient"});
    if(!Array.isArray(patients)||patients.length>=100) return reply(409,{message:"Dentrix could not establish a unique patient. Check the chart."});
    const exact=patients.filter(p=>!p.duplicateOfPatient?.id && normalized(p.firstName)===normalized(first)
      && normalized(p.lastName)===normalized(last) && String(p.dateOfBirth).slice(0,10)===dob);
    if(exact.length>1) return reply(409,{message:"More than one patient matches. Verify the charts in Ascend before recording use."});
    if(!exact.length) return reply(200,{visits:[]});
    const patient=exact[0], location=locations[office];
    if(!/^\d+$/.test(refId(patient))) throw new Error("patient");
    // An Eastern service day lies entirely between 04:00 UTC and 05:00 UTC the next day.
    const end=new Date(date+"T05:00:00.000Z");end.setUTCDate(end.getUTCDate()+1);
    const appts=await read("appointments",{filter:["patient.id=="+patient.id,"location.id=="+location,
      "start>="+date+"T04:00:00.000Z","start<"+end.toISOString()].join(","),pageSize:"50",
      responseFields:"id,start,status,patient,location,provider,patientProcedures"});
    if(!Array.isArray(appts)||appts.length>=50) throw new Error("appointments");
    const eligible=appts.filter(a=>refId(a.patient)===String(patient.id) && refId(a.location)===location && localDay(a.start)===date
      && !/cancel|broken|reschedul|missed|no.?show|deleted/i.test(String(a.status)) && /^\d+$/.test(refId(a.provider)));
    const service=env("SUPABASE_SERVICE_ROLE_KEY");
    const visits=[];
    for(const a of eligible) {
      const linked=[...new Set((a.patientProcedures||[]).map(refId).filter((id:string)=>/^\d+$/.test(id)))];
      if(linked.length>35) return reply(409,{message:"Verify this visit in Ascend. It has too many linked procedures to match safely."});
      const procedures=await Promise.all(linked.map(id=>read("patientprocedures/"+id,{responseFields:"id,patient,location,serviceDate,status,state,renderingProvider,practiceProcedure,procedureTeeth,oralCavity"})));
      const confirmed=procedures.filter(p=>p && String(p.status)==="COMPLETED" && String(p.state)==="ACTIVE" && refId(p.patient)===String(patient.id)
        && refId(p.location)===location && String(p.serviceDate).slice(0,10)===date && /^\d+$/.test(refId(p.renderingProvider)));
      for(const procedure of [...confirmed,null]){
        const providerId=refId(procedure?.renderingProvider||a.provider);
        if(!/^\d+$/.test(providerId))continue;
        const provider=await read("providers/"+providerId,{responseFields:"id,firstName,lastName"});
        if(refId(provider)!==providerId) throw new Error("provider");
        const providerName=[provider.firstName,provider.lastName].filter(Boolean).join(" ");
        if(!providerName) continue;
        let procedureLabel="";
        if(procedure && /^\d+$/.test(refId(procedure.practiceProcedure))){
          const definition=await read("practiceprocedures/"+refId(procedure.practiceProcedure),{});
          procedureLabel=[definition?.code,definition?.description].filter(v=>typeof v==="string"&&v).join(" · ");
          if(!procedureLabel)procedureLabel="Ascend procedure "+procedure.id;
        }
        const site=(procedure?.procedureTeeth||[]).map((t:any)=>t.toothId).filter(Boolean).join(", ") || procedure?.oralCavity || "";
        const visit={patientId:String(patient.id),patientName:[patient.firstName,patient.lastName].join(" "),chartNumber:String(patient.chartNumber||""),
          appointmentId:String(a.id),date,start:a.start,providerName,providerId,procedureId:procedure?String(procedure.id):"",procedureLabel,site};
        const token=await fetchJSON(base+"/rest/v1/rpc/issue_clinical_scan_confirmation",{method:"POST",
          headers:{apikey:service,Authorization:"Bearer "+service,"Content-Type":"application/json"},body:JSON.stringify({actor:user.id,office,visit})});
        visits.push({confirmation:token,patientName:visit.patientName,chartNumber:visit.chartNumber,date,start:a.start,providerName,procedureLabel,site});
      }
    }
    return reply(200,{visits});
  } catch {
    return reply(503,{message:"The live Dentrix visit lookup is unavailable. Try again before recording use."});
  }
});
