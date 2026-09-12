import json,urllib.request,urllib.error
url='https://api.nudashboard.com/v2/rcm/pos-collections?startDate=2999-01-01&endDate=2999-01-01&page=1&pageSize=1'
out=[]
for label,extra in [('no_key',{}),('invalid_test_key',{'X-API-Key':'NDASH-QA-INVALID-NONCREDENTIAL'})]:
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0',**extra})
    try:
        with urllib.request.urlopen(req,timeout=30) as r:status=r.status
    except urllib.error.HTTPError as e:status=e.code
    out.append({'case':label,'status':status,'response_body_not_loaded':True})
print(json.dumps({'read_only_empty_future_period':True,'results':out}))
