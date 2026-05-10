import { proxyKyro } from '../server/kyroProxy.js';

export default function handler(request, response) {
  const id = Array.isArray(request.query.id) ? request.query.id[0] : request.query.id;
  if (!id) {
    response.status(400).json({ error: 'Missing run id' });
    return;
  }
  return proxyKyro(request, response, ['runs', id], ['id']);
}
