import json
import urllib.request

# Get approval link for batch cmv1p4y1d0003nt0u9oeqoqqh or step
# First log in as admin
login_url = "http://13.126.39.176:3000/auth/login"
data = json.dumps({"email": "admin@example.test", "password": "demo123"}).encode()
req = urllib.request.Request(login_url, data=data, headers={"Content-Type": "application/json"})
with urllib.request.urlopen(req) as resp:
    token = json.loads(resp.read().decode())["token"]

# Fetch batches
b_req = urllib.request.Request("http://13.126.39.176:3000/batches?organizationId=demo-org", headers={
    "Authorization": f"Bearer {token}"
})
with urllib.request.urlopen(b_req) as b_resp:
    batches = json.loads(b_resp.read().decode())
    for b in batches:
        print("Batch ID:", b["id"], "Status:", b["status"])
        for s in b.get("stepInstances", []):
            print("  Step:", s["id"], "Status:", s["status"], "Stage:", s.get("stage", {}).get("order"))

