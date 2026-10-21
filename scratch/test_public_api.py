import json
import urllib.request

url = "http://13.126.39.176:3001/auth/login"
data = json.dumps({"email": "admin@example.test", "password": "demo123"}).encode()
req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})

print("Testing public connection to EC2 API: http://13.126.39.176:3001...")
with urllib.request.urlopen(req) as resp:
    res = json.loads(resp.read().decode())
    token = res["token"]
    print("Public Login SUCCESS! User:", res["user"]["name"])

batch_req = urllib.request.Request("http://13.126.39.176:3001/batches?organizationId=demo-org", headers={
    "Authorization": f"Bearer {token}"
})
with urllib.request.urlopen(batch_req) as b_resp:
    batches = json.loads(b_resp.read().decode())
    print("Public Fetch Batches SUCCESS! Total batches:", len(batches))

