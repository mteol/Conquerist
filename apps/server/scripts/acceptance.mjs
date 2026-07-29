// Abnahmeskript fuer Etappe 0. Prueft den ganzen Weg Browser -> Vite -> Server.
import WebSocket from 'ws';

const VITE = 'ws://localhost:5173/ws';
const GOOD_ORIGIN = 'http://localhost:5173';
const BAD_ORIGIN = 'http://evil.example';

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` -- ${detail}` : ''}`);
}

async function health() {
  const response = await fetch('http://127.0.0.1:8080/health');
  const body = await response.json();
  record('GET /health', response.status === 200 && body.status === 'ok', JSON.stringify(body));
}

function pingThroughProxy() {
  return new Promise((resolve) => {
    const socket = new WebSocket(VITE, { origin: GOOD_ORIGIN });
    const timer = setTimeout(() => {
      record('WS ping/pong ueber Vite-Proxy', false, 'Timeout nach 8s');
      socket.terminate();
      resolve();
    }, 8000);

    socket.on('open', () => {
      record('WS-Handshake ueber Vite-Proxy (Origin 5173)', true, 'verbunden');
      const sentAt = Date.now();
      socket.send(JSON.stringify({ id: 'accept-1', type: 'ping', payload: {} }));

      socket.once('message', (raw) => {
        clearTimeout(timer);
        const message = JSON.parse(raw.toString());
        const rtt = Date.now() - sentAt;
        const ok =
          message.replyTo === 'accept-1' &&
          message.type === 'pong' &&
          message.ok === true &&
          typeof message.payload?.serverTime === 'number';
        record('WS ping/pong ueber Vite-Proxy', ok, `${JSON.stringify(message)} rtt=${rtt}ms`);
        socket.close();
        resolve();
      });
    });

    socket.on('error', (error) => {
      clearTimeout(timer);
      record('WS-Handshake ueber Vite-Proxy (Origin 5173)', false, error.message);
      resolve();
    });
  });
}

function invalidPayload() {
  return new Promise((resolve) => {
    const socket = new WebSocket(VITE, { origin: GOOD_ORIGIN });
    socket.on('open', () => {
      socket.send(JSON.stringify({ id: 'accept-2', type: 'ping', payload: 'kein objekt' }));
      socket.once('message', (raw) => {
        const message = JSON.parse(raw.toString());
        record(
          'Ungueltige Payload -> INVALID_PAYLOAD mit replyTo',
          message.ok === false &&
            message.error?.code === 'INVALID_PAYLOAD' &&
            message.replyTo === 'accept-2',
          JSON.stringify(message),
        );
        socket.close();
        resolve();
      });
    });
    socket.on('error', (error) => {
      record('Ungueltige Payload -> INVALID_PAYLOAD mit replyTo', false, error.message);
      resolve();
    });
  });
}

function unknownType() {
  return new Promise((resolve) => {
    const socket = new WebSocket(VITE, { origin: GOOD_ORIGIN });
    socket.on('open', () => {
      socket.send(JSON.stringify({ id: 'accept-3', type: 'buildCity', payload: {} }));
      socket.once('message', (raw) => {
        const message = JSON.parse(raw.toString());
        record(
          'Unbekannter type -> UNKNOWN_TYPE',
          message.ok === false && message.error?.code === 'UNKNOWN_TYPE',
          JSON.stringify(message),
        );
        socket.close();
        resolve();
      });
    });
    socket.on('error', (error) => {
      record('Unbekannter type -> UNKNOWN_TYPE', false, error.message);
      resolve();
    });
  });
}

function rejectsForeignOrigin() {
  return new Promise((resolve) => {
    // Direkt gegen den Server, nicht durch den Proxy - Vite wuerde den Origin
    // unveraendert durchreichen, aber der direkte Weg ist der klarere Test.
    const socket = new WebSocket('ws://127.0.0.1:8080/ws', { origin: BAD_ORIGIN });
    socket.on('open', () => {
      record('Fremder Origin wird abgelehnt', false, 'Handshake kam durch');
      socket.close();
      resolve();
    });
    socket.on('unexpected-response', (_request, response) => {
      record(
        'Fremder Origin wird abgelehnt',
        response.statusCode === 403,
        `HTTP ${response.statusCode}`,
      );
      resolve();
    });
    socket.on('error', (error) => {
      record('Fremder Origin wird abgelehnt', /403/.test(error.message), error.message);
      resolve();
    });
  });
}

function rejectsWrongPath() {
  return new Promise((resolve) => {
    const socket = new WebSocket('ws://127.0.0.1:8080/nope', { origin: GOOD_ORIGIN });
    socket.on('open', () => {
      record('Falscher Pfad wird abgelehnt', false, 'Handshake kam durch');
      socket.close();
      resolve();
    });
    socket.on('unexpected-response', (_request, response) => {
      record(
        'Falscher Pfad wird abgelehnt',
        response.statusCode === 404,
        `HTTP ${response.statusCode}`,
      );
      resolve();
    });
    socket.on('error', (error) => {
      record('Falscher Pfad wird abgelehnt', /404/.test(error.message), error.message);
      resolve();
    });
  });
}

await health();
await pingThroughProxy();
await invalidPayload();
await unknownType();
await rejectsForeignOrigin();
await rejectsWrongPath();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} Pruefungen bestanden`);
process.exit(failed.length === 0 ? 0 : 1);
