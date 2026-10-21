import urllib.request
import re

html = urllib.request.urlopen("http://13.126.39.176:3000").read().decode("utf-8")
scripts = re.findall(r'src=["\']([^"\']+)["\']', html)
print("SCRIPTS IN HTML:", len(scripts))
for s in scripts:
    url = "http://13.126.39.176:3000" + s if s.startswith("/") else s
    try:
        resp = urllib.request.urlopen(url)
        print("  OK:", s, len(resp.read()), "bytes")
    except Exception as e:
        print("  FAIL:", s, e)

