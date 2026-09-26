const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data', 'reservations.json');
const MIME_TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.ico': 'image/x-icon' };

async function readReservations() {
  try { return JSON.parse(await fs.readFile(DATA_FILE, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

async function saveReservations(reservations) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(reservations, null, 2), 'utf8');
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function getBody(request) {
  return new Promise((resolve, reject) => {
    let raw = '';
    request.on('data', (chunk) => { raw += chunk; if (raw.length > 100_000) request.destroy(); });
    request.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { reject(new Error('Invalid JSON request body.')); } });
    request.on('error', reject);
  });
}

function validateReservation(data) {
  const required = ['guestName', 'email', 'destination', 'checkIn', 'checkOut', 'guests'];
  for (const field of required) if (!String(data[field] || '').trim()) return `${field} is required.`;
  if (!/^\S+@\S+\.\S+$/.test(data.email)) return 'Please provide a valid email address.';
  const checkIn = new Date(`${data.checkIn}T00:00:00`);
  const checkOut = new Date(`${data.checkOut}T00:00:00`);
  if (Number.isNaN(checkIn.valueOf()) || Number.isNaN(checkOut.valueOf()) || checkOut <= checkIn) return 'Check-out must be after check-in.';
  return null;
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  try {
    if (request.method === 'GET' && url.pathname === '/api/health') return sendJson(response, 200, { status: 'ok' });

    if (request.method === 'POST' && url.pathname === '/api/reservations') {
      const data = await getBody(request);
      const validationError = validateReservation(data);
      if (validationError) return sendJson(response, 400, { error: validationError });
      const reservation = { id: crypto.randomUUID(), guestName: data.guestName.trim(), email: data.email.trim().toLowerCase(), destination: data.destination, checkIn: data.checkIn, checkOut: data.checkOut, guests: data.guests, createdAt: new Date().toISOString() };
      const reservations = await readReservations();
      reservations.push(reservation);
      await saveReservations(reservations);
      return sendJson(response, 201, { message: 'Reservation request received.', reservationId: reservation.id });
    }

    if (request.method === 'GET' && url.pathname === '/api/reservations') return sendJson(response, 200, await readReservations());

    const requestedPath = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    const filePath = path.resolve(ROOT, `.${requestedPath}`);
    if (!filePath.startsWith(ROOT + path.sep)) return sendJson(response, 403, { error: 'Forbidden' });
    const content = await fs.readFile(filePath);
    response.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream' });
    response.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') return sendJson(response, 404, { error: 'Not found' });
    console.error(error);
    sendJson(response, 500, { error: 'Something went wrong on the server.' });
  }
});

server.listen(PORT, () => console.log(`YaatraStay is running at http://localhost:${PORT}`));
