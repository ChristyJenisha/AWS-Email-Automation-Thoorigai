export async function onRequest(context) {
  const url = new URL(context.request.url);

  // 1. Handle CORS preflight requests
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

  // 2. Pure backend API routes: proxy to the EC2 backend via Cloudflare Tunnel
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

  // 3. Frontend static page resolution:
  // Match section routes and serve their index.html directly from ASSETS to prevent any 308 redirect loops
  const cleanPath = url.pathname.replace(/\/$/, '');
  const staticPages = ['/batches', '/payments', '/settings', '/approve', '/legacy'];
  const matchedPage = staticPages.find((p) => cleanPath === p || cleanPath.startsWith(p + '/'));

  if (matchedPage && context.env.ASSETS) {
    const pageName = matchedPage.slice(1);
    const assetUrl = new URL(`/${pageName}/index.html`, url.origin);
    const assetRes = await context.env.ASSETS.fetch(assetUrl);
    if (assetRes.status === 200) {
      const newHeaders = new Headers(assetRes.headers);
      newHeaders.set('Content-Type', 'text/html; charset=utf-8');
      return new Response(assetRes.body, {
        status: 200,
        headers: newHeaders,
      });
    }
  }

  // Not an API or special page route -> serve frontend static assets
  return context.next();
}
