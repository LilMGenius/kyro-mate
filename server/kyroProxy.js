const defaultBaseUrl = 'https://kyro-hackathon.vercel.app';

function appendQuery(url, query, ignoredKeys = []) {
  Object.entries(query).forEach(([key, value]) => {
    if (ignoredKeys.includes(key)) return;
    const values = Array.isArray(value) ? value : [value];
    values.forEach((item) => {
      if (item !== undefined) url.searchParams.append(key, item);
    });
  });
}

export async function proxyKyro(request, response, pathParts, ignoredQueryKeys = []) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.status(405).json({ error: 'KYRO Mate proxy is read-only' });
    return;
  }

  const apiKey = process.env.KYRO_API_KEY || process.env.KYRO_API_TOKEN;
  if (!apiKey) {
    response.status(500).json({ error: 'Missing KYRO_API_KEY server environment variable' });
    return;
  }

  const baseUrl = process.env.KYRO_API_BASE_URL || defaultBaseUrl;
  const path = pathParts.map(encodeURIComponent).join('/');
  const upstreamUrl = new URL(`/api/v1/${path}`, baseUrl);
  appendQuery(upstreamUrl, request.query, ignoredQueryKeys);

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const body = await upstreamResponse.text();
    response.setHeader('Content-Type', upstreamResponse.headers.get('content-type') || 'application/json');
    response.status(upstreamResponse.status).send(body);
  } catch {
    response.status(502).json({ error: 'KYRO API proxy request failed' });
  }
}
