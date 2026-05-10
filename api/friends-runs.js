import { proxyKyro } from '../server/kyroProxy.js';

export default function handler(request, response) {
  return proxyKyro(request, response, ['friends', 'runs']);
}
