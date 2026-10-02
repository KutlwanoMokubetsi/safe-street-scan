// k6 load test: 1,000 concurrent signed-in users browsing CrimeSpot, each with a live WebSocket.
//
//   1. Install k6: https://k6.io/docs/get-started/installation/
//   2. Sign in to the web app, open the browser console, run:  JSON.parse(localStorage['crimespot.session']).token
//      (a test account's access token; it lasts 5 minutes, so start the test straight away)
//   3. k6 run -e TOKEN=<token> docs/loadtest/crimespot-1000.js
//
// Note: the API's per-user rate limits apply, and every virtual user shares the same token here, so the
// sustained request rate is kept below 300 reads/minute per user to measure capacity, not the limiter.
import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';

const API = __ENV.API || 'https://crimespot-api.onrender.com';
const WS = API.replace(/^http/, 'ws') + '/ws';
const H = { headers: { Authorization: `Bearer ${__ENV.TOKEN}` } };

export const options = {
  scenarios: {
    sockets: { executor: 'constant-vus', vus: 1000, duration: '4m', exec: 'socket' },
    browsing: { executor: 'constant-arrival-rate', rate: 4, timeUnit: '1s', duration: '4m', preAllocatedVUs: 50, exec: 'browse' },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:stats}': ['p(95)<500'],
    'http_req_duration{name:live}': ['p(95)<800'],
  },
};

export function socket() {
  ws.connect(WS, { headers: { Origin: 'https://crimespot-web.onrender.com' } }, s => {
    s.on('open', () => s.send(JSON.stringify({ type: 'auth', token: __ENV.TOKEN })));
    s.setInterval(() => s.send(JSON.stringify({ type: 'ping' })), 25000);
    s.setTimeout(() => s.close(), 230000);
  });
}

export function browse() {
  check(http.get(`${API}/api/stats`, { ...H, tags: { name: 'stats' } }), { 'stats 200': r => r.status === 200 });
  check(http.get(`${API}/api/live`, { ...H, tags: { name: 'live' } }), { 'live 200': r => r.status === 200 });
  http.get(`${API}/api/hotspots`, { ...H, tags: { name: 'hotspots' } });
  sleep(1);
}
