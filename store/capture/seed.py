# seed.py: demo account on the local server (memory store): portal account with a plan and 3 apps,
# Approvals workspace with a second approver. Writes state.json.
import requests, json, time, glob, os, re, email, sys
D=os.path.dirname(os.path.abspath(__file__)); MAIL=D+'/mail'; B='http://127.0.0.1:8080'
def lastmail(after, to):
    for _ in range(40):
        fs=sorted((f for f in glob.glob(MAIL+'/*.eml') if os.path.getmtime(f)>after), key=os.path.getmtime)
        for f in reversed(fs):
            m=email.message_from_file(open(f))
            if to in m['To']:
                for p in m.walk():
                    if p.get_content_type()=='text/plain': return p.get_payload(decode=True).decode()
        time.sleep(0.25)
    raise SystemExit('no mail to '+to)
EMAIL='aiko@sakura-tea.example'
o=requests.Session(); o.headers.update({'Origin':B})
t0=time.time()
r=o.post(B+'/api/v1/signup',json={'email':EMAIL,'password':'Demo-password-123!','name':'Sakura Tea','locale':'en','accept_terms':True}); r.raise_for_status()
acct=r.json()['account']['id']
# The link carries its token in the fragment; the page posts it.
token=re.search(r'verify-email\S*[#?]token=([\w.~-]+)',lastmail(t0,EMAIL)).group(1)
o.post(B+'/api/v1/verify-email',json={'token':token}).raise_for_status()
csrf=o.get(B+'/api/v1/me').json()['csrf_token']; o.headers['X-CSRF-Token']=csrf
# console: plan
c=requests.Session(); c.headers.update({'Origin':B})
c.post(B+'/admin/api/setup',json={'token':'dev-setup-token-0123456789','email':'ops@hibira.example'})
t1=time.time(); p=c.post(B+'/admin/api/login',json={'email':'ops@hibira.example'}).json()['pending']
code=re.search(r'page: (\d+)',lastmail(t1,'ops@')).group(1)
c.post(B+'/admin/api/login/code',json={'email':'ops@hibira.example','pending':p,'code':code}).raise_for_status()
c.headers['X-CSRF-Token']=c.get(B+'/admin/api/session').json()['csrf_token']
c.post(B+f'/admin/api/accounts/{acct}/plan',json={'max_apps':10,'max_connections':5000,'daily_messages':20000000,'monthly_price':8900,'currency':'usd','note':'demo'}).raise_for_status()
apps=[o.post(B+'/api/v1/apps',json={'name':n}).json() for n in ['Storefront','Order tracking','Live auction']]
# approvals
a=requests.Session(); a.headers.update({'Origin':'http://approvals.localhost:8080','Host':'approvals.localhost:8080'})
t2=time.time(); p=a.post(B+'/api/v1/login',json={'email':EMAIL,'locale':'en'}).json()['pending']
code=re.search(r'(\d{6})',lastmail(t2,EMAIL)).group(1)
a.headers['X-CSRF-Token']=a.post(B+'/api/v1/login/code',json={'pending':p,'code':code}).json()['csrf_token']
a.put(B+'/api/v1/me',json={'name':'Aiko Tanaka'})
ws=a.post(B+'/api/v1/workspaces',json={'name':'Sakura Tea'}).json()['id']
a.put(B+f'/api/v1/workspaces/{ws}/members',json={'email':'kenji@sakura-tea.example','role':'approver'})
key=a.post(B+f'/api/v1/workspaces/{ws}/keys',json={'name':'Shop backend','scope':'write'}).json()['key']
st={'acct':acct,'apps':apps,'ws':ws,'key':key,
    'owner_cookies':o.cookies.get_dict(),'owner_csrf':csrf,
    'appr_cookies':a.cookies.get_dict(),'appr_csrf':a.headers['X-CSRF-Token']}
json.dump(st,open(D+'/state.json','w'),indent=1)
print('seeded',acct,ws,[x['name'] for x in apps])
