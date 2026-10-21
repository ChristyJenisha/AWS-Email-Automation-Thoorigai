import json
import urllib.request

url = "http://localhost:3001/auth/login"
data = json.dumps({"email": "admin@example.test", "password": "demo123"}).encode()
req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})

try:
    with urllib.request.urlopen(req) as resp:
        print("LOGIN_SUCCESS:", resp.read().decode())
except urllib.error.HTTPError as e:
    print("HTTP_ERROR:", e.code, e.read().decode())
except Exception as e:
    print("ERROR:", e)

