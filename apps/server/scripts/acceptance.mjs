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

/**
 * Ein Spieler an einer eigenen Verbindung.
 *
 * Bewusst ohne den Client: geprueft wird das Protokoll, nicht die Oberflaeche.
 * Jeder Spieler haelt seinen letzten Raum- und Spielstand, so wie der Browser
 * es auch tut.
 */
function player(label) {
  const socket = new WebSocket(VITE, { origin: GOOD_ORIGIN });
  const pending = new Map();
  const self = { label, userId: null, secret: null, room: null, game: null };

  socket.on('message', (raw) => {
    const message = JSON.parse(raw.toString());

    if (message.replyTo !== undefined && pending.has(message.replyTo)) {
      const { resolve, reject } = pending.get(message.replyTo);
      pending.delete(message.replyTo);
      if (message.ok) resolve(message.payload);
      else reject(new Error(`${message.error.code}: ${message.error.message}`));
      return;
    }

    if (message.type === 'room.state') self.room = message.payload;
    if (message.type === 'game.state') self.game = message.payload;
  });

  self.open = new Promise((resolve, reject) => {
    socket.on('open', resolve);
    socket.on('error', reject);
  });

  self.send = (type, payload) =>
    new Promise((resolve, reject) => {
      const id = `${label}-${Math.random().toString(36).slice(2)}`;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, type, payload }));
      setTimeout(() => {
        if (pending.delete(id)) reject(new Error(`${label}: ${type} ohne Antwort`));
      }, 8000);
    });

  self.close = () => socket.close();
  return self;
}

const settle = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

/** Der Weg, den Etappe 4 ausmacht: drei Geraete, eine Partie, verdeckte Haende. */
async function onlineGame() {
  const anna = player('anna');
  const ben = player('ben');
  const cem = player('cem');

  try {
    await Promise.all([anna.open, ben.open, cem.open]);

    for (const [who, name] of [
      [anna, 'Anna'],
      [ben, 'Ben'],
      [cem, 'Cem'],
    ]) {
      const hello = await who.send('hello', { name });
      who.userId = hello.userId;
      who.secret = hello.secret;
    }
    record(
      'hello legt drei Gaeste mit eigener Id an',
      new Set([anna.userId, ben.userId, cem.userId]).size === 3,
      `${anna.userId?.slice(0, 8)} / ${ben.userId?.slice(0, 8)} / ${cem.userId?.slice(0, 8)}`,
    );

    const { code } = await anna.send('room.create', { seatCount: 3, seed: 'abnahme' });
    await ben.send('room.join', { code });
    await cem.send('room.join', { code });
    await settle();

    record(
      'Drei Spieler sitzen am selben Tisch',
      anna.room?.seats.length === 3 && cem.room?.code === code,
      `Raum ${code}`,
    );

    // Der Wartebereich bleibt formbar, solange niemand gestartet hat.
    await anna.send('room.configure', { seatCount: 4, seed: 'umgestellt' });
    await settle();
    record(
      'Der Host stellt die Partie im Wartebereich um',
      cem.room?.seatCount === 4 && cem.room?.seed === 'umgestellt',
      `${cem.room?.seatCount} Plaetze, Seed ${cem.room?.seed}`,
    );

    let configureRefused = false;
    try {
      await ben.send('room.configure', { seatCount: 6, seed: 'fremd' });
    } catch {
      configureRefused = true;
    }
    record('Nur der Host darf umstellen', configureRefused, 'abgelehnt');

    // Zurueck auf drei, damit der Tisch fuer den Start wieder voll ist.
    await anna.send('room.configure', { seatCount: 3, seed: 'abnahme' });
    await settle();

    await anna.send('room.start', {});
    await settle(400);

    const view = ben.game?.view;
    const foreign = view?.players.filter((entry) => entry.id !== ben.userId) ?? [];
    record(
      'Jeder bekommt seine eigene Sicht',
      view?.you === ben.userId && anna.game?.view.you === anna.userId,
      `Ben sieht ${view?.you?.slice(0, 8)}`,
    );
    record(
      'Fremde Handkarten bleiben verdeckt',
      foreign.length === 2 && foreign.every((entry) => entry.resources === null),
      `${foreign.length} fremde Haende, alle null`,
    );
    record(
      'Der Zufallszustand verlaesst den Server nicht',
      !JSON.stringify(ben.game).includes('"rng"'),
      'kein rng in der Sicht',
    );

    const acting = [anna, ben, cem].filter((who) => (who.game?.actions.length ?? 0) > 0);
    record(
      'Nur einer hat in der Gruendung Zuege',
      acting.length === 1,
      `${acting.length} Spieler mit Zuegen`,
    );

    // Fremdzug: Ben schickt einen Zug fuer Anna. Der Server glaubt dem
    // player-Feld nicht (Regel 3).
    let refused = false;
    try {
      await ben.send('game.act', { action: { type: 'rollDice', player: anna.userId } });
    } catch {
      refused = true;
    }
    record('Ein Zug fuer einen anderen wird abgelehnt', refused, 'abgelehnt');

    // Gruendungsphase durchspielen, jeder nur seine eigenen Zuege.
    let steps = 0;
    while ((anna.game?.view.phase.kind ?? 'setup') === 'setup' && steps < 60) {
      const turn = [anna, ben, cem].find((who) => (who.game?.actions.length ?? 0) > 0);
      if (turn === undefined) break;
      await turn.send('game.act', { action: turn.game.actions[0] });
      await settle(60);
      steps += 1;
    }
    record(
      'Die Gruendungsphase laeuft ueber sechs Runden durch',
      anna.game?.view.phase.kind === 'rollPending' && steps === 12,
      `${steps} Zuege, danach ${anna.game?.view.phase.kind}`,
    );
    record(
      'Der Verlaufssatz kommt vom Server',
      typeof anna.game?.entry === 'string' && anna.game.entry.length > 0,
      anna.game?.entry ?? '(keiner)',
    );

    // Reconnect: Ben faellt weg und kommt mit demselben Geheimnis zurueck.
    ben.close();
    await settle(400);
    record(
      'Ein Abriss macht den Platz nicht frei',
      anna.room?.seats.length === 3 &&
        anna.room.seats.find((seat) => seat.name === 'Ben')?.connected === false,
      'Platz belegt, als getrennt gefuehrt',
    );

    const back = player('ben-2');
    await back.open;
    const identity = await back.send('hello', { secret: ben.secret });
    await settle(400);
    record(
      'Das Geheimnis bringt dieselbe Person zurueck',
      identity.userId === ben.userId && identity.secret === undefined,
      'gleiche Id, kein neues Geheimnis',
    );
    record(
      'Der Stand ist nach dem Reconnect sofort wieder da',
      back.game !== null && back.room !== null && back.game.view.you === ben.userId,
      'Raum und Partie zugestellt',
    );
    back.close();
  } catch (error) {
    record('Online-Partie ueber drei Verbindungen', false, error.message);
  } finally {
    anna.close();
    cem.close();
  }
}

await health();
await pingThroughProxy();
await invalidPayload();
await unknownType();
await rejectsForeignOrigin();
await rejectsWrongPath();
await onlineGame();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} Pruefungen bestanden`);
process.exit(failed.length === 0 ? 0 : 1);
