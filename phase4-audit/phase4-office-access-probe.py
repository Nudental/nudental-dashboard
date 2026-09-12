"""Read only the missing-key status for one already-scoped API route."""
import json,urllib.request,urllib.error
url='https://api.nudashboard.com/v2/rcm/daily-comparison?date=2026-09-11'
out={}
for name,headers in [('default_client',{}),('ordinary_browser',{'User-Agent':'Mozilla/5.0'})]:
    try:
        with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=20) as response:out[name]=response.status
    except urllib.error.HTTPError as error:out[name]=error.code
print(json.dumps({'read_only':True,'missing_key_status':out}))
