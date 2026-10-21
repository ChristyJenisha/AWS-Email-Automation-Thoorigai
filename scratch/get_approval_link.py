import json
import urllib.request

# Login as admin
login_url = "http://13.126.39.176:3000/auth/login"
data = json.dumps({"email": "admin@example.test", "password": "demo123"}).encode()
req = urllib.request.Request(login_url, data=data, headers={"Content-Type": "application/json"})
with urllib.request.urlopen(req) as resp:
    token = json.loads(resp.read().decode())["token"]

# Get approval link for alerted step
step_id = "cmuz3mueh0007o28un5iw4r5r"
link_req = urllib.request.Request(f"http://13.126.39.176:3000/workflows/steps/{step_id}/approval-link", headers={
    "Authorization": f"Bearer {token}"
})
with urllib.request.urlopen(link_req) as l_resp:
    res = json.loads(l_resp.read().decode())
    print("APPROVAL_LINK_RESULT:", json.dumps(res, indent=2))

