const defaultBaseUrl = 'https://kyro-hackathon.vercel.app';

function getPathParts(path) {
  if (Array.isArray(path)) return path;
  if (typeof path === 'string') return [path];
  return [];
}

function appendQuery(url, query) {
  Object.entries(query).forEach(([key, value]) => {
    if (key === 'path') return;
    const values = Array.isArray(value) ? value : [value];
    values.forEach((item) => {
      if (item !== undefined) url.searchParams.append(key, item);
    });
  });
}

export default async function handler(request, response) {
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
  const path = getPathParts(request.query.path).map(encodeURIComponent).join('/');
  const upstreamUrl = new URL(`/api/v1/${path}`, baseUrl);
  appendQuery(upstreamUrl, request.query);

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
