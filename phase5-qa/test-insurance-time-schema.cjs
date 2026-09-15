// Prove the existing database contract without writing any hosted record.
const {openSchema}=require('./offline_database.cjs');
const assert=require('node:assert/strict');
(async()=>{const {db}=await openSchema();try{
 const sql=`INSERT INTO insurance_verification_requests(submission_date,requesting_staff_name,appointment_date,appointment_time,patient_first_name,patient_last_name,patient_dob,patient_phone,insurance_company_name,insurance_phone,member_id,status) VALUES('2026-09-15','QA TEMP','2027-01-10',$1,'QA TEMP','time-contract','2000-01-01','','QA MOCK','2025550123','QA-NOT-VALID','requested') RETURNING appointment_time`;
 let failure;try{await db.query(sql,[null])}catch(error){failure=error}
 assert.equal(failure?.code,'23502');assert.equal(failure?.column,'appointment_time');
 assert.equal((await db.query('SELECT count(*)::int AS n FROM insurance_verification_requests')).rows[0].n,0);
 assert.equal((await db.query(sql,['09:00'])).rows[0].appointment_time,'09:00:00');
 console.log(JSON.stringify({checks:3,passed:3,productionConnected:false,missingTimeSqlstate:failure.code,column:failure.column}));
}finally{await db.close()}})().catch(error=>{console.log(JSON.stringify({result:'FAIL',message:String(error.message).slice(0,180)}));process.exitCode=1});
