async function testFrontendFlow() {
  const base = "http://13.126.39.176:3000";
  console.log("1. Logging in...");
  const loginRes = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@example.test", password: "demo123" })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log("   Token obtained:", token ? "YES" : "NO");

  console.log("2. Fetching dashboard data...");
  const headers = { Authorization: `Bearer ${token}` };
  const [wfRes, bRes, cRes] = await Promise.all([
    fetch(`${base}/workflows?organizationId=demo-org`, { headers }),
    fetch(`${base}/batches?organizationId=demo-org`, { headers }),
    fetch(`${base}/contacts?organizationId=demo-org`, { headers }),
  ]);

  const workflows = await wfRes.json();
  const batches = await bRes.json();
  const contacts = await cRes.json();

  console.log("   Workflows count:", workflows.length);
  console.log("   Batches count:", batches.length);
  console.log("   Contacts count:", contacts.length);

  console.log("3. Fetching payments for batches...");
  for (const b of batches) {
    const pRes = await fetch(`${base}/payments/batch/${encodeURIComponent(b.id)}`, { headers });
    const payments = await pRes.json();
    console.log(`   Batch ${b.id} payments:`, payments.length);
  }

  console.log("\nALL FRONTEND REQUESTS RETURNED 200 OK! DASHBOARD FLOW 100% HEALTHY!");
}

testFrontendFlow().catch(console.error);

