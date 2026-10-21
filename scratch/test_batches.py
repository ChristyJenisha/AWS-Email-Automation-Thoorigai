import json
import urllib.request

url = "http://localhost:3001/auth/login"
data = json.dumps({"email": "admin@example.test", "password": "demo123"}).encode()
req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})

with urllib.request.urlopen(req) as resp:
    res = json.loads(resp.read().decode())
    token = res["token"]

# Now test batches endpoint
batch_req = urllib.request.Request("http://localhost:3001/batches?organizationId=demo-org", headers={
    "Authorization": f"Bearer {token}"
})
with urllib.request.urlopen(batch_req) as b_resp:
    batches = json.loads(b_resp.read().decode())
    print("BATCHES_COUNT:", len(batches))
    for b in batches[:3]:
        print("  - Batch:", b.get("id"), "Status:", b.get("status"), "Bills:", len(b.get("bills", [])))

