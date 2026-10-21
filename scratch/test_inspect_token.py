import json
import urllib.request

token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGVwSW5zdGFuY2VJZCI6ImNtdXozbXVlaDAwMDdvMjh1bjVpdzRyNXIiLCJhY3RvcklkIjoiZGVtby1hcHByb3ZlciIsIm9yZ2FuaXphdGlvbklkIjoiZGVtby1vcmciLCJpYXQiOjE3OTI1NTY4NDZ9.QLKDN6H9yfqFbxnFeKS56Kosqav0Y3_WawBmHELZ5AY"

# Inspect token via port 3000 proxy
url = "http://13.126.39.176:3000/approvals/inspect"
req = urllib.request.Request(url, data=json.dumps({"token": token}).encode(), headers={"Content-Type": "application/json"})
with urllib.request.urlopen(req) as resp:
    res = json.loads(resp.read().decode())
    print("INSPECT_SUCCESS:")
    print("  Batch ID:", res.get("batchId"))
    print("  Organization:", res.get("organizationName"))
    print("  Stage Order:", res.get("stageOrder"))
    print("  Bills Count:", len(res.get("bills", [])))
    for bill in res.get("bills", []):
        print(f"    * Invoice: {bill.get('billNumber')}, Amount: Rs. {bill.get('amount')}, Due: {bill.get('dueDate')}")

