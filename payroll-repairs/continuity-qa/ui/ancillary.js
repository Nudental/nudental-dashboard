// Only the unchanged legacy hygienist companion panel is stubbed. The doctor
// selector/service/component and server source adapter/calculation are real.
export const getScheduleYears=()=>[2026,2027,2028];
export const getPayrollScheduleForYear=()=>[];
export const formatDateShort=v=>new Date(v+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
export const fetchPayrollData=async()=>({doctors:[],hygienists:[],dataSource:'synthetic-companion'});
export const ALL_DENTRIX_OFFICES=[{officeName:'QA Office A',locationId:'21'},{officeName:'QA Office B',locationId:'22'}];
export const ascendApi={getProviders:async()=>({providers:[]})};
