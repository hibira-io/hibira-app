# prep.py <lang>: switch the demo to a language and give the inbox that language's requests.
import requests, json, sys, time
import os; D=os.path.dirname(os.path.abspath(__file__)); B='http://127.0.0.1:8080'
L=sys.argv[1]; X=json.load(open(D+'/texts.json'))[L]; st=json.load(open(D+'/state.json'))
o=requests.Session(); o.cookies.update(st['owner_cookies']); o.headers.update({'Origin':B,'X-CSRF-Token':st['owner_csrf']})
print('portal', o.patch(B+'/api/v1/me',json={'locale':X['locale']}).status_code)
a=requests.Session(); a.cookies.update(st['appr_cookies']); a.headers.update({'Origin':'http://approvals.localhost:8080','Host':'approvals.localhost:8080','X-CSRF-Token':st['appr_csrf']})
print('approvals', a.put(B+'/api/v1/me',json={'name':'Aiko Tanaka','locale':X['locale']}).status_code)
k={'Host':'approvals.localhost:8080','Authorization':'Bearer '+st['key']}
pend=requests.get(B+'/v1/requests?status=pending&limit=100',headers=k).json()['items']
for p in pend:
    pid=p.get('approval_id') or p.get('id')
    r=a.post(B+f'/api/v1/requests/{pid}/answer',json={'choice':p['options'][0]}); print('answered',pid,r.status_code)
opts={'en':['Approve','Reject']}
ids=[]
for i,(title,details,agent) in enumerate(reversed(X['req'])):
    r=requests.post(B+'/v1/requests',headers=k,json={'title':title,'details':details,'agent':agent,'expires_in_minutes':[1440,480,180,90][i]})
    r.raise_for_status(); ids.append(r.json()['approval_id']); time.sleep(0.3)
json.dump({'ids':list(reversed(ids))},open(D+'/cur.json','w'))
print('created',len(ids))
