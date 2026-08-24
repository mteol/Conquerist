import { rollOpening } from './openingFixture.js';
import { describe, expect, it } from 'vitest';
import {
  MAX_VICTORY_POINT_GOAL,
  MIN_VICTORY_POINT_GOAL,
  SEAT_COLORS,
  legalActions,
  setupPlayer,
  stampAction,
  type GameAction,
  type GameState,
} from '@conquerist/shared';
import {
  abandonRoom,
  applyAction,
  applySystemAction,
  chooseColor,
  configureRoom,
  createRoom,
  isAway,
  joinRoom,
  leaveRoom,
  renameSeat,
  setConnected,
  startGame,
  type Room,
} from './room.js';

function room(): Room {
  const created = createRoom('K7X2', 'u1', 'Anna', 3, 'raum-probe', 10);
  if (!created.ok) throw new Error(created.error);
  return created.room;
}

function withThree(): Room {
  let current = room();
  for (const [id, name] of [
    ['u2', 'Ben'],
    ['u3', 'Cem'],
  ] as const) {
    const joined = joinRoom(current, id, name);
    if (!joined.ok) throw new Error(joined.error);
    current = joined.room;
  }
  return current;
}

describe('Raum', () => {
  it('setzt den Ersteller auf den ersten Platz und macht ihn zum Host', () => {
    const created = room();
    expect(created.hostId).toBe('u1');
    expect(created.seats).toHaveLength(1);
    expect(created.seats[0]).toMatchObject({ userId: 'u1', name: 'Anna', connected: true });
    expect(created.game).toBeNull();
  });

  it('vergibt Farben in der Reihenfolge des Beitritts', () => {
    const full = withThree();
    expect(new Set(full.seats.map((seat) => seat.color)).size).toBe(3);
  });

  it('laesst niemanden zweimal beitreten, sondern erkennt ihn wieder', () => {
    const again = joinRoom(withThree(), 'u2', 'Ben');
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.room.seats).toHaveLength(3);
  });

  it('weist ab, wenn der Tisch voll ist', () => {
    const result = joinRoom(withThree(), 'u4', 'Dana');
    expect(result.ok).toBe(false);
  });

  it('startet nur auf Wunsch des Hosts', () => {
    const full = withThree();
    expect(startGame(full, 'u2').ok).toBe(false);

    const started = startGame(full, 'u1');
    expect(started.ok).toBe(true);
    if (started.ok) {
      expect(started.room.game).not.toBeNull();
      expect(started.room.version).toBeGreaterThan(full.version);
    }
  });

  it('startet nicht mit unvollstaendigem Tisch', () => {
    expect(startGame(room(), 'u1').ok).toBe(false);
  });

  it('nimmt einen Zug nur vom richtigen Spieler an', () => {
    const started = startGame(withThree(), 'u1');
    if (!started.ok) throw new Error(started.error);
    // Erst den Auftakt zu Ende wuerfeln - vorher gibt es keine Gruendungszuege.
    const running = rollOpening(started.room);
    const game = running.game!;

    const first = legalActions(game, setupPlayer(game)!)[0]!;
    const wrongPlayer = running.seats.find((seat) => seat.userId !== setupPlayer(game))!;

    // Fremder Zug: abgelehnt, Zustand unveraendert.
    const rejected = applyAction(running, wrongPlayer.userId, first);
    expect(rejected.ok).toBe(false);

    const accepted = applyAction(running, setupPlayer(game)!, first);
    expect(accepted.ok).toBe(true);
    if (accepted.ok) expect(accepted.room.version).toBe(running.version + 1);
  });

  it('laesst den Host die Partie im Wartebereich noch umstellen', () => {
    const changed = configureRoom(room(), 'u1', 5, 'anderer-seed', 10);

    expect(changed.ok).toBe(true);
    if (changed.ok) {
      expect(changed.room.seatCount).toBe(5);
      expect(changed.room.seed).toBe('anderer-seed');
      expect(changed.room.version).toBeGreaterThan(room().version);
    }
  });

  it('laesst nur den Host umstellen', () => {
    expect(configureRoom(withThree(), 'u2', 6, 'egal', 10).ok).toBe(false);
  });

  it('macht den Tisch nicht kleiner als die Zahl derer, die schon sitzen', () => {
    // Sonst muesste jemand seinen Platz raeumen, den er schon hat - und der
    // Wartebereich waere der falsche Ort, das zu entscheiden.
    expect(configureRoom(withThree(), 'u1', 3, 'raum-probe', 10).ok).toBe(true);
    const shrunk = configureRoom(withThree(), 'u1', 2, 'raum-probe', 10);
    expect(shrunk.ok).toBe(false);
  });

  it('weist eine Tischgroesse ohne passendes Brett zurueck', () => {
    expect(configureRoom(room(), 'u1', 7, 'raum-probe', 10).ok).toBe(false);
  });

  it('stellt eine laufende Partie nicht mehr um', () => {
    const started = startGame(withThree(), 'u1');
    if (!started.ok) throw new Error(started.error);

    expect(configureRoom(started.room, 'u1', 4, 'zu-spaet', 10).ok).toBe(false);
  });

  it('behaelt den Platz, wenn die Verbindung abbricht', () => {
    const gone = setConnected(withThree(), 'u2', false);
    expect(gone.seats).toHaveLength(3);
    expect(gone.seats.find((seat) => seat.userId === 'u2')?.connected).toBe(false);
    // Ein Abriss ist keine Entscheidung: wer herausfaellt, ist nicht gegangen.
    expect(isAway(gone, 'u2')).toBe(false);
  });

  /**
   * Weggegangen und weggebrochen sind zweierlei.
   *
   * Daran haengt, ob der Server beim naechsten `hello` diesen Tisch von sich
   * aus wieder oeffnet - und damit, ob ein Neuladen einen zurueck in eine
   * Partie setzt, die man gerade verlassen hat.
   */
  it('merkt sich einen Austritt aus der laufenden Partie und nimmt ihn beim Beitritt zurueck', () => {
    const started = startGame(withThree(), 'u1');
    if (!started.ok) throw new Error(started.error);

    const left = leaveRoom(started.room, 'u2');
    expect(isAway(left, 'u2')).toBe(true);
    // Die anderen bleiben unberuehrt - es geht um einen und nicht um den Tisch.
    expect(isAway(left, 'u1')).toBe(false);

    const back = joinRoom(left, 'u2', 'Ben');
    if (!back.ok) throw new Error(back.error);
    expect(isAway(back.room, 'u2')).toBe(false);
    expect(back.room.seats.find((seat) => seat.userId === 'u2')?.connected).toBe(true);
  });

  it('nennt niemanden weggegangen, der nie am Tisch sass', () => {
    expect(isAway(withThree(), 'u9')).toBe(false);
  });

  it('gibt einen Platz im Wartebereich frei, aber nicht in der laufenden Partie', () => {
    const waiting = leaveRoom(withThree(), 'u2');
    expect(waiting.seats).toHaveLength(2);

    const started = startGame(withThree(), 'u1');
    if (!started.ok) throw new Error(started.error);
    const afterLeave = leaveRoom(started.room, 'u2');
    expect(afterLeave.seats).toHaveLength(3);
    expect(afterLeave.seats.find((seat) => seat.userId === 'u2')?.connected).toBe(false);
    expect(isAway(afterLeave, 'u2')).toBe(true);
  });
});

describe('Aussteigen', () => {
  it('gibt im Wartebereich nur den Platz frei', () => {
    const result = abandonRoom(withThree(), 'u2');

    expect(result.kind).toBe('left');
    if (result.kind !== 'left') throw new Error('kein Austritt');
    expect(result.room.seats.map((seat) => seat.userId)).toEqual(['u1', 'u3']);
  });

  it('beendet eine laufende Partie, statt den Spieler herauszunehmen', () => {
    const started = startGame(withThree(), 'u1');
    if (!started.ok) throw new Error(started.error);

    const result = abandonRoom(started.room, 'u2');

    expect(result.kind).toBe('ended');
    if (result.kind !== 'ended') throw new Error('nicht beendet');
    // Der Raum kommt unveraendert zurueck: die Sitzenden sollen noch erfahren,
    // was mit ihrer Partie passiert ist.
    expect(result.room.seats).toHaveLength(3);
  });

  it('laesst einen Fremden den Tisch nicht abraeumen', () => {
    const started = startGame(withThree(), 'u1');
    if (!started.ok) throw new Error(started.error);

    expect(abandonRoom(started.room, 'u9').kind).toBe('none');
  });
});

describe('Zeit und Systemzuege', () => {
  /** Eine laufende Partie in der Hauptphase, u1 am Zug und mit drei Holz. */
  function inMainPhase(): Room {
    const started = startGame(withThree(), 'u1');
    if (!started.ok) throw new Error(started.error);
    const game = started.room.game!;

    const running: GameState = {
      ...game,
      phase: { kind: 'main' },
      currentPlayerIndex: 0,
      players: game.players.map((player, index) =>
        index === 0 ? { ...player, resources: { ...player.resources, lumber: 3 } } : player,
      ),
    };

    return { ...started.room, game: running };
  }

  const offer = (at: number): GameAction => ({
    type: 'offerTrade',
    player: 'u1',
    give: { brick: 0, lumber: 2, wool: 0, grain: 0, ore: 0 },
    want: { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 1 },
    at,
  });

  function withOpenOffer(): Room {
    const acted = applyAction(inMainPhase(), 'u1', stampAction(offer(5), 10_000));
    if (!acted.ok) throw new Error(acted.error);
    return acted.room;
  }

  it('rechnet die Frist aus der gestempelten Zeit, nicht aus der mitgeschickten', () => {
    const room = withOpenOffer();
    const game = room.game!;

    expect(game.phase.kind).toBe('tradePending');
    if (game.phase.kind !== 'tradePending') return;
    expect(game.phase.expiresAt).toBe(10_000 + game.rules.tradeOfferMs);
  });

  it('weist einen Zug fuer einen anderen Spieler ab - auch einen Systemzug', () => {
    const room = withOpenOffer();

    // `dropFromTrade` spricht ueber u2, kaeme aber ueber die Verbindung von u1.
    const rejected = applyAction(room, 'u1', { type: 'dropFromTrade', player: 'u2' });

    expect(rejected.ok).toBe(false);
  });

  it('nimmt denselben Zug ueber den Systemeingang an', () => {
    const room = withOpenOffer();

    const accepted = applySystemAction(room, { type: 'dropFromTrade', player: 'u2' });

    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    const phase = accepted.room.game!.phase;
    expect(phase.kind).toBe('tradePending');
    if (phase.kind !== 'tradePending') return;
    expect(phase.responses.u2).toEqual({ kind: 'declined', automatic: true });
  });

  it('laesst die Frist nicht abkuerzen, solange sie laeuft', () => {
    const room = withOpenOffer();

    expect(applySystemAction(room, { type: 'timeout', player: 'u1', at: 10_001 }).ok).toBe(false);
    expect(
      applySystemAction(room, {
        type: 'timeout',
        player: 'u1',
        at: 10_000 + room.game!.rules.tradeOfferMs,
      }).ok,
    ).toBe(true);
  });
});

/**
 * Etappe 10: die Farbe wird gewaehlt und folgt nicht mehr dem Platz.
 *
 * Der Unterschied ist groesser als er aussieht: solange sie eine Funktion der
 * Position war, konnte sie sich hinter jedem Beitritt und jedem Verlassen
 * aendern. Jetzt gehoert sie dem, der sie genommen hat.
 */
describe('Farbwahl', () => {
  it('nimmt eine freie Farbe an', () => {
    const changed = chooseColor(withThree(), 'u2', SEAT_COLORS[4]!);

    expect(changed.ok).toBe(true);
    if (changed.ok) {
      expect(changed.room.seats.find((seat) => seat.userId === 'u2')?.color).toBe(SEAT_COLORS[4]);
    }
  });

  it('weist eine Farbe ab, die schon jemand hat - und sagt, wer', () => {
    const table = withThree();
    const taken = table.seats[0]!.color;

    const changed = chooseColor(table, 'u2', taken);

    expect(changed.ok).toBe(false);
    if (!changed.ok) expect(changed.error).toContain('Anna');
  });

  it('laesst die eigene Farbe noch einmal waehlen, ohne sich selbst im Weg zu stehen', () => {
    const table = withThree();
    const mine = table.seats[1]!.color;

    expect(chooseColor(table, 'u2', mine).ok).toBe(true);
  });

  it('kennt nur die Farben des Tisches', () => {
    expect(chooseColor(withThree(), 'u2', 'rebeccapurple').ok).toBe(false);
  });

  it('faerbt nicht mehr um, sobald die Partie laeuft', () => {
    const started = startGame(withThree(), 'u1');
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    expect(chooseColor(started.room, 'u2', SEAT_COLORS[4]!).ok).toBe(false);
  });

  /*
   * Der Fehler, den dieser Test verhindert: bis Etappe 9 wurden die
   * Verbliebenen hier neu durchgezaehlt. Wer sich Violett ausgesucht hatte,
   * sass danach in Rot, weil vor ihm jemand gegangen war.
   */
  it('laesst den Uebrigen ihre Farbe, wenn jemand geht', () => {
    const table = withThree();
    const chosen = chooseColor(table, 'u3', SEAT_COLORS[4]!);
    expect(chosen.ok).toBe(true);
    if (!chosen.ok) return;

    const after = leaveRoom(chosen.room, 'u1');

    expect(after.seats.find((seat) => seat.userId === 'u3')?.color).toBe(SEAT_COLORS[4]);
    expect(after.seats.find((seat) => seat.userId === 'u2')?.color).toBe(table.seats[1]!.color);
  });

  it('gibt dem Naechsten die erste freie Farbe und keine zweimal', () => {
    const table = withThree();
    const chosen = chooseColor(table, 'u2', SEAT_COLORS[5]!);
    expect(chosen.ok).toBe(true);
    if (!chosen.ok) return;

    const grown = configureRoom(chosen.room, 'u1', 4, 'raum-probe', 10);
    expect(grown.ok).toBe(true);
    if (!grown.ok) return;

    const joined = joinRoom(grown.room, 'u4', 'Dana');
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    const colors = joined.room.seats.map((seat) => seat.color);
    expect(new Set(colors).size).toBe(colors.length);
    expect(joined.room.seats.find((seat) => seat.userId === 'u4')?.color).toBe(SEAT_COLORS[1]);
  });
});

describe('Umbenennen', () => {
  it('zieht den Namen am Sitz nach', () => {
    const after = renameSeat(withThree(), 'u2', 'Benedikt');
    expect(after.seats.find((seat) => seat.userId === 'u2')?.name).toBe('Benedikt');
  });

  it('gibt denselben Raum zurueck, wenn sich nichts aendert', () => {
    const table = withThree();
    expect(renameSeat(table, 'u2', 'Ben')).toBe(table);
    expect(renameSeat(table, 'wer-auch-immer', 'Egal')).toBe(table);
  });
});

describe('Siegpunktziel', () => {
  it('stellt sich im Wartebereich um', () => {
    const changed = configureRoom(room(), 'u1', 3, 'raum-probe', 15);
    expect(changed.ok).toBe(true);
    if (changed.ok) expect(changed.room.victoryPointGoal).toBe(15);
  });

  it('bleibt in seinen Grenzen', () => {
    expect(configureRoom(room(), 'u1', 3, 'raum-probe', MIN_VICTORY_POINT_GOAL - 1).ok).toBe(false);
    expect(configureRoom(room(), 'u1', 3, 'raum-probe', MAX_VICTORY_POINT_GOAL + 1).ok).toBe(false);
    expect(configureRoom(room(), 'u1', 3, 'raum-probe', MIN_VICTORY_POINT_GOAL).ok).toBe(true);
    expect(configureRoom(room(), 'u1', 3, 'raum-probe', MAX_VICTORY_POINT_GOAL).ok).toBe(true);
  });

  /*
   * Der eigentliche Punkt: das eingestellte Ziel muss im RuleSet der Partie
   * ankommen. Steht es nur am Raum, spielt der Tisch weiter bis zehn und
   * wundert sich.
   */
  it('geht beim Start in das Regelwerk der Partie', () => {
    const changed = configureRoom(withThree(), 'u1', 3, 'raum-probe', 7);
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;

    const started = startGame(changed.room, 'u1');
    expect(started.ok).toBe(true);
    if (started.ok) expect(started.room.game?.rules.victoryPointGoal).toBe(7);
  });
});
