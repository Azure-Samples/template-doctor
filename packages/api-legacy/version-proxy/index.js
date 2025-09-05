// Generic version proxy: forwards /api/v4/* -> /api/* to enable frontend versioning rollout
// This avoids duplicating every function while we migrate to native versioned routes.

module.exports = async function (context, req) {
  const { rest } = req.params || {};
  const incomingPath = rest || '';

  // Handle CORS preflight quickly
  if (req.method === 'OPTIONS') {
    return context.res = {
      status: 200,
      headers: corsHeaders(req),
      body: ''
    };
  }

  if (!incomingPath) {
    context.log('version-proxy: missing path segment');
    context.res = {
      status: 400,
      headers: corsHeaders(req),
      body: JSON.stringify({ error: 'Missing path after version segment' })
    };
    return;
  }

  try {
    const targetUrl = buildTargetUrl(incomingPath, req.query);
    context.log(`version-proxy forwarding ${req.method} ${req.originalUrl} -> ${targetUrl}`);

    const init = {
      method: req.method,
      headers: filterForwardHeaders(req.headers || {}),
      redirect: 'manual'
    };

    if (req.body) {
      // Preserve JSON bodies; Azure Functions may give already parsed object
      if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
        init.body = JSON.stringify(req.body);
        init.headers['content-type'] = init.headers['content-type'] || 'application/json';
      } else {
        init.body = req.rawBody || req.body;
      }
    }

    const response = await fetch(targetUrl, init);

    const buf = Buffer.from(await response.arrayBuffer());
    const headersObj = Object.fromEntries(response.headers.entries());
    Object.assign(headersObj, corsHeaders(req));

    context.res = {
      status: response.status,
      headers: headersObj,
      body: buf
    };
  } catch (err) {
    context.log.error('version-proxy error', err);
    context.res = {
      status: 500,
      headers: corsHeaders(req),
      body: JSON.stringify({ error: 'Version proxy failure', details: err.message })
    };
  }
};

function buildTargetUrl(restPath, query) {
  // Support local & hosted
  const host = process.env.WEBSITE_HOSTNAME
    ? `https://${process.env.WEBSITE_HOSTNAME}`
    : `http://localhost:${process.env.FUNCTIONS_CUSTOMHANDLER_PORT || process.env.FUNCTIONS_HTTPWORKER_PORT || 7071}`;
  let base = host.replace(/\/$/, '') + '/api/';
  const trimmed = restPath.replace(/^\/+/,'');
  let url = base + trimmed;
  const qp = new URLSearchParams();
  if (query) {
    for (const [k,v] of Object.entries(query)) {
      if (v !== undefined && v !== null) qp.append(k, v);
    }
  }
  const qs = qp.toString();
  if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  return url;
}

function filterForwardHeaders(headers) {
  const out = {};
  for (const [k,v] of Object.entries(headers)) {
    if (!v) continue;
    const lk = k.toLowerCase();
    // Skip hop-by-hop / host specific headers
    if ([ 'host', 'connection', 'content-length' ].includes(lk)) continue;
    out[lk] = v;
  }
  return out;
}

function corsHeaders(req) {
  const origin = req.headers && (req.headers.origin || req.headers.Origin) || '*';
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'Content-Type,Authorization,x-functions-key',
    'access-control-expose-headers': 'Content-Type',
    'access-control-allow-credentials': 'true'
  };
}
