export async function onRequest(context) {
  const url = new URL(context.request.url);

  // Handle CORS preflight requests
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // Pure backend API routes: proxy to the EC2 backend via Cloudflare Tunnel
  // Frontend pages (/batches, /payments, /settings, /approve, /legacy, /) are served statically
  const isApi =
    url.pathname.startsWith('/api/') ||
    url.pathname === '/api' ||
    url.pathname === '/health' ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/approvals/');

  if (isApi) {
    const backendOrigin = context.env.BACKEND_API_URL || 'https://fact-heritage-qualified-grace.trycloudflare.com';
    const targetPath = url.pathname.replace(/^\/api(?=\/|$)/, '') || '/';
    const targetUrl = `${backendOrigin}${targetPath}${url.search}`;

    const newHeaders = new Headers(context.request.headers);
    newHeaders.set('host', 'fact-heritage-qualified-grace.trycloudflare.com');

    const requestInit = {
      method: context.request.method,
      headers: newHeaders,
      redirect: 'follow',
    };

    if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
      requestInit.body = context.request.body;
    }

    try {
      const response = await fetch(targetUrl, requestInit);
      const newResponseHeaders = new Headers(response.headers);
      newResponseHeaders.set('Access-Control-Allow-Origin', '*');
      newResponseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      newResponseHeaders.set('Access-Control-Allow-Headers', '*');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newResponseHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Backend unreachable', details: String(err) }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  }

  // Not an API request -> serve frontend static pages
  return context.next();
}
