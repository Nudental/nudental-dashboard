const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const file=require('node:path').join(__dirname,'../recovered-frontend/src/services/insuranceReviewLinks.js');
const modulePromise=import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(file)).toString('base64'));
const id='00000000-0000-0000-0000-000000000001';
test('review links accept only request UUIDs',async()=>{
 const {insuranceReviewLink}=await modulePromise;
 assert.equal(insuranceReviewLink(id),'/insurance-verify?request='+id);
 for(const value of [null,'','https://example.com','javascript:alert(1)',id+'?office=other'])assert.equal(insuranceReviewLink(value),null);
});
test('request link uses the office-restricted view and exact ID',async()=>{
 const {loadInsuranceReviewRequest}=await modulePromise;const calls=[];
 const client={from(v){calls.push(v);return this;},select(v){calls.push(v);return this;},eq(k,v){calls.push([k,v]);return this;},async maybeSingle(){return {data:{id}};}};
 assert.deepEqual(await loadInsuranceReviewRequest(client,id),{id});
 assert.deepEqual(calls,['insurance_work_requests','*',['id',id]]);
 client.maybeSingle=async()=>({data:null});
 await assert.rejects(loadInsuranceReviewRequest(client,id),/outside your office access/);
 client.maybeSingle=async()=>({error:{message:'database detail'}});
 await assert.rejects(loadInsuranceReviewRequest(client,id),/unavailable/);
 await assert.rejects(loadInsuranceReviewRequest(null,'bad'),/Invalid request link/);
});
