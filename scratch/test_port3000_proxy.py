import json
import urllib.request

url = "http://13.126.39.176:3000/auth/login"
data = json.dumps({"email": "admin@example.test", "password": "demo123"}).encode()
req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})

print("Testing login proxied through port 3000...")
with urllib.request.urlopen(req) as resp:
    res = json.loads(resp.read().decode())
    token = res["token"]
    print("PORT 3000 PROXY LOGIN SUCCESS! User:", res["user"]["name"])

batch_req = urllib.request.Request("http://13.126.39.176:3000/batches?organizationId=demo-org", headers={
    "Authorization": f"Bearer {token}"
})
with urllib.request.urlopen(batch_req) as b_resp:
    batches = json.loads(b_resp.read().decode())
    print("PORT 3000 PROXY BATCHES SUCCESS! Total batches:", len(batches))

