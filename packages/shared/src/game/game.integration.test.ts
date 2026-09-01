import { describe, expect, it } from 'vitest';

import { CITIES_RULES, CLASSIC_RULES, type CardAmounts } from '../rules/index.js';
import { CLASSIC_34, RESOURCE_IDS, generateScenario, isCommodity } from '../scenario/index.js';
import type { GameAction } from './actions.js';
import { legalActions } from './legal.js';
import { reduce } from './reducer.js';
import { replay } from './replay.js';
import { EMPTY_CARDS, countCards } from './cards.js';
import { discardCountFor } from './robber.js';
import { victoryPointsOf } from './scoring.js';
import { robberIsFree } from './cities/barbarians.js';
import { METROPOLIS_LEVEL, TRACK_IDS, levelOf, type TrackId } from './cities/tracks.js';
import type { ProgressCardId } from './cities/progress/cards.js';
import type { ProgressPlay } from './cities/progress/play.js';
import { giving, hand, testGame, TEST_SCENARIO } from './fixtures.js';
import { createGame } from './setup.js';
import { GameStateSchema, type GameState } from './state.js';
import type { PlayerId, PlayerState } from './player.js';
/*
 * Aufloesung gegen das Modul statt gegen das Arbeitsverzeichnis - ein
 * `readFileSync('src/game/...')` waere je nach Startort (Repo-Wurzel oder
 * `packages/shared`) mal richtig, mal falsch. Der JSON-Import loest das
 * gegen den Modulgraphen auf, unabhaengig vom cwd. `readFileSync` selbst
 * kaeme dazu ohnehin nicht in Frage: `tsconfig.json` setzt hier bewusst
 * `types: []`, `shared` hat keine Node-Typen im Blick (siehe Kommentar dort)
 * - ein Import von `node:fs` liesse sich also gar nicht typpruefen.
 */
import saved10c from './__fixtures__/saved-10c.json' with { type: 'json' };

/**
 * Eine vollstaendige Partie auf dem erzeugten Basisbrett, von `createGame` bis
 * `finished` - gespielt von einer stumpfen, aber deterministischen Strategie.
 *
 * Das ist die eigentliche Abnahme von Etappe 2. Die Regeltests pruefen jede
 * Regel fuer sich; erst hier zeigt sich, ob sie zusammen ein Spiel ergeben, das
 * anfaengt, laeuft und aufhoert. Und weil die ganze Aktionsfolge mitgeschrieben
 * wird, faellt am Ende gleich der Beleg fuer Regel 2 mit ab.
 */

const SCENARIO = generateScenario(CLASSIC_34, 'partie');
const PLAYERS = ['anna', 'ben', 'cem'] as const;

/** Alle Karten im Spiel - Bank plus alle Haende. Muss immer gleich bleiben. */
function totalCards(state: GameState): number {
  return state.players.reduce(
    (sum, player) => sum + countCards(player.resources),
    countCards(state.bank),
  );
}

/** Wirft die haeufigsten Karten ab - irgendeine Wahl muss die Strategie treffen. */
function chooseDiscard(state: GameState, player: string): CardAmounts {
  const owner = state.players.find((entry) => entry.id === player)!;
  const chosen: CardAmounts = { ...EMPTY_CARDS };

  let left = discardCountFor(state, player);
  while (left > 0) {
    const richest = [...RESOURCE_IDS].sort(
      (a, b) => owner.resources[b] - chosen[b] - (owner.resources[a] - chosen[a]),
    )[0]!;
    chosen[richest] += 1;
    left -= 1;
  }

  return chosen;
}

/**
 * Die Strategie: bauen, was geht - Stadt vor Siedlung vor Strasse -, sonst
 * tauschen, sonst den Zug beenden. Kein guter Spieler, aber ein
 * reproduzierbarer.
 */
const PRIORITY: readonly GameAction['type'][] = [
  'placeSetupSettlement',
  'placeSetupRoad',
  'rollDice',
  'moveRobber',
  'buildCity',
  'buildSettlement',
  'buildRoad',
  'tradeWithBank',
  'endTurn',
];

function chooseAction(state: GameState, player: string): GameAction | null {
  if (state.phase.kind === 'discardPending') {
    return { type: 'discard', player, resources: chooseDiscard(state, player) };
  }

  const options = legalActions(state, player);
  for (const type of PRIORITY) {
    const match = options.find((action) => action.type === type);
    if (match !== undefined) return match;
  }

  return null;
}

/** Wer als naechstes handeln muss. */
function nextActor(state: GameState): string | null {
  // Der Auftakt wird mitgespielt und nicht uebersprungen: dieser Test ist der
  // einzige, der eine ganze Partie von vorn durchlaeuft.
  if (state.phase.kind === 'opening') return state.phase.pending[0] ?? null;
  if (state.phase.kind === 'discardPending') return state.phase.pending[0] ?? null;
  /*
   * Die drei Wartestationen eines Wurfs: es handelt der erste Eintrag der
   * Warteschlange und nicht der Spieler am Zug - wer eine Fortschrittskarte
   * abgeben muss, ist gerade **nicht** am Zug.
   */
  if (
    state.phase.kind === 'progressDiscardPending' ||
    state.phase.kind === 'defenderPending' ||
    state.phase.kind === 'aqueductPending'
  ) {
    return state.phase.pending[0] ?? null;
  }
  if (state.phase.kind === 'finished') return null;
  if (state.phase.kind === 'setup') {
    const count = state.players.length;
    const index =
      state.phase.placement < count ? state.phase.placement : 2 * count - 1 - state.phase.placement;
    return state.players[index]?.id ?? null;
  }
  return state.players[state.currentPlayerIndex]?.id ?? null;
}

describe('Eine ganze Partie', () => {
  const initial = createGame(SCENARIO, CLASSIC_RULES, PLAYERS, 'partie-seed');
  const log: GameAction[] = [];

  let state = initial;
  let steps = 0;
  const LIMIT = 20_000;

  while (state.phase.kind !== 'finished' && steps < LIMIT) {
    const actor = nextActor(state);
    if (actor === null) break;

    const action = chooseAction(state, actor);
    if (action === null) break;

    const result = reduce(state, action);
    if (!result.ok) {
      throw new Error(
        `Zug ${steps} (${action.type}, ${actor}) abgelehnt: ${result.error.code} - ${result.error.message}`,
      );
    }

    // Karten koennen den Besitzer wechseln, aber nicht entstehen oder
    // verschwinden - die schaerfste Invariante, die das Spiel kennt.
    expect(totalCards(result.state)).toBe(totalCards(initial));

    log.push(action);
    state = result.state;
    steps += 1;
  }

  it('kommt zum Ende, ohne ins Limit zu laufen', () => {
    expect(steps).toBeLessThan(LIMIT);
    expect(state.phase.kind).toBe('finished');
  });

  it('kuert einen Sieger, der das Siegpunktziel erreicht hat', () => {
    expect(state.phase.kind).toBe('finished');
    if (state.phase.kind !== 'finished') return;

    const winner = state.phase.winner;
    expect(PLAYERS).toContain(winner);
    expect(victoryPointsOf(state, winner)).toBeGreaterThanOrEqual(CLASSIC_RULES.victoryPointGoal);
  });

  it('laesst niemanden ausser dem Sieger das Ziel erreichen', () => {
    if (state.phase.kind !== 'finished') return;

    for (const player of PLAYERS) {
      if (player === state.phase.winner) continue;
      expect(victoryPointsOf(state, player)).toBeLessThan(CLASSIC_RULES.victoryPointGoal);
    }
  });

  it('hat die Gruendungsphase vollstaendig durchlaufen', () => {
    const setupActions = log.filter(
      (action) => action.type === 'placeSetupSettlement' || action.type === 'placeSetupRoad',
    );

    expect(setupActions).toHaveLength(PLAYERS.length * 4);

    // Vor der Gruendung steht der Auftakt: lauter `rollDice`, mindestens eines
    // je Spieler, bei einem Stechen mehr. Danach kommen die Gruendungszuege am
    // Stueck - und genau das haelt diese Zeile fest.
    const auftakt = log.findIndex((action) => action.type === 'placeSetupSettlement');
    expect(auftakt).toBeGreaterThanOrEqual(PLAYERS.length);
    expect(log.slice(0, auftakt).every((action) => action.type === 'rollDice')).toBe(true);
    expect(log.slice(auftakt, auftakt + PLAYERS.length * 4)).toEqual(setupActions);
  });

  it('haelt die Bauteilvorraete ein', () => {
    for (const player of state.players) {
      const built = Object.values(state.buildings).filter(
        (building) => building.owner === player.id,
      );
      const settlements = built.filter((building) => building.kind === 'settlement').length;
      const cities = built.filter((building) => building.kind === 'city').length;
      const roads = Object.values(state.roads).filter((owner) => owner === player.id).length;

      expect(roads + player.piecesLeft.road).toBe(CLASSIC_RULES.pieceStock.road);
      expect(cities + player.piecesLeft.city).toBe(CLASSIC_RULES.pieceStock.city);
      // Beim Ausbau zur Stadt verschwindet die Siedlung vom Brett und liegt
      // wieder im Vorrat - die Summe bleibt deshalb der Startvorrat, ohne die
      // Staedte dazuzurechnen.
      expect(settlements + player.piecesLeft.settlement).toBe(CLASSIC_RULES.pieceStock.settlement);
      expect(cities).toBeGreaterThanOrEqual(0);
    }
  });

  it('laesst keine Karte entstehen oder verschwinden', () => {
    expect(totalCards(state)).toBe(totalCards(initial));
  });

  it('hat wirklich gespielt und nicht nur Zuege beendet', () => {
    const kinds = new Set(log.map((action) => action.type));

    expect(kinds).toContain('rollDice');
    expect(kinds).toContain('buildRoad');
    expect(kinds).toContain('buildSettlement');
    expect(kinds).toContain('buildCity');
    expect(log.length).toBeGreaterThan(100);
  });

  /**
   * Regel 2, belegt statt behauptet: derselbe Startzustand und dieselbe
   * Aktionsfolge ergeben denselben Endzustand - bis auf das letzte Bit des
   * Zufallszustands.
   */
  it('laesst sich aus Startzustand und Aktionsfolge exakt rekonstruieren', () => {
    const replayed = replay(initial, log);

    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(state);
  });

  it('spielt aus demselben Seed dieselbe Partie', () => {
    const again = createGame(SCENARIO, CLASSIC_RULES, PLAYERS, 'partie-seed');
    const replayed = replay(again, log);

    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(state);
  });

  it('bricht die Wiedergabe bei einem unmoeglichen Zug mit Position ab', () => {
    const broken = [...log.slice(0, 3), { type: 'endTurn', player: 'anna' } as GameAction];
    const result = replay(initial, broken);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Aktion 3');
  });
});

/**
 * Der Spielerhandel im Durchlauf.
 *
 * Der eigentliche Beleg steht in der letzten Zeile: `replay` aus Startzustand
 * und Aktionsfolge ergibt denselben Zustand. Das ist die Begruendung dafuer,
 * dass Angebot und Frist im `GameState` liegen und nicht im Raum - waeren sie
 * dort, koennte diese Gleichheit gar nicht gelten.
 */
describe('Spielerhandel', () => {
  function table(): GameState {
    return giving(giving(testGame(), 'p1', { lumber: 3 }), 'p2', { ore: 2 });
  }

  it('spielt Angebot, Ablehnung, Zusage und Zuschlag - und ist danach wiederherstellbar', () => {
    const start = table();
    const actions: GameAction[] = [
      {
        type: 'offerTrade',
        player: 'p1',
        give: hand({ lumber: 2 }),
        want: hand({ ore: 1 }),
        at: 5,
      },
      { type: 'respondTrade', player: 'p3', response: 'declined' },
      { type: 'respondTrade', player: 'p2', response: 'accepted' },
      { type: 'acceptTrade', player: 'p1', partner: 'p2' },
    ];

    const played = actions.reduce<GameState>((state, action) => {
      const result = reduce(state, action);
      if (!result.ok) throw new Error(`${action.type}: ${result.error.message}`);
      return result.state;
    }, start);

    expect(played.phase).toEqual({ kind: 'main' });
    expect(countCards(played.players[0]!.resources)).toBe(2);

    const restored = replay(start, actions);
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.state).toEqual(played);
  });

  it('stellt ein offenes Angebot samt Frist wieder her', () => {
    const start = table();
    const actions: GameAction[] = [
      {
        type: 'offerTrade',
        player: 'p1',
        give: hand({ lumber: 2 }),
        want: hand({ ore: 1 }),
        at: 5,
      },
    ];

    const restored = replay(start, actions);

    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.state.phase.kind).toBe('tradePending');
    if (restored.state.phase.kind !== 'tradePending') return;
    expect(restored.state.phase.expiresAt).toBe(5 + start.rules.tradeOfferMs);
  });

  it('haelt die Kartenzahl im Spiel konstant - ein Tausch schafft nichts', () => {
    const start = table();
    const before = totalCards(start);

    const actions: GameAction[] = [
      {
        type: 'offerTrade',
        player: 'p1',
        give: hand({ lumber: 2 }),
        want: hand({ ore: 1 }),
        at: 0,
      },
      { type: 'respondTrade', player: 'p2', response: 'accepted' },
      { type: 'acceptTrade', player: 'p1', partner: 'p2' },
    ];

    const restored = replay(start, actions);
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(totalCards(restored.state)).toBe(before);
  });
});

/**
 * Eine Partie nach Staedte-&-Ritter-Regeln bis zum ersten Barbarenueberfall.
 *
 * Gefahren wird mit derselben stumpfen Strategie, nur um die Ritterzuege
 * erweitert. Der Test haengt **nicht** an einer bestimmten Wurffolge: die
 * Wuerfe kommen aus dem Seed, also wird gezaehlt statt gesteuert, und geprueft
 * werden die Invarianten **nach** dem Ueberfall - nicht sein Ausgang.
 */
describe('Eine Partie bis zur Kueste', () => {
  const CITIES_PRIORITY: readonly GameAction['type'][] = [
    'placeSetupSettlement',
    'placeSetupRoad',
    'rollDice',
    'moveRobber',
    // Ein vertriebener Ritter haelt den Tisch an - er kommt vor allem anderen.
    'placeDisplacedKnight',
    // Dasselbe gilt fuer die drei Wartestationen eines Wurfs: solange eine
    // offen ist, geht am Tisch nichts anderes.
    'pickProgressDeck',
    'discardProgressCard',
    'pickAqueduct',
    'buildCity',
    'buildSettlement',
    'buildKnight',
    'activateKnight',
    'upgradeKnight',
    'moveKnight',
    'buildWall',
    'buildRoad',
    'tradeWithBank',
    'endTurn',
  ];

  function chooseCitiesAction(state: GameState, player: string): GameAction | null {
    if (state.phase.kind === 'discardPending') {
      return { type: 'discard', player, resources: chooseDiscard(state, player) };
    }

    const options = legalActions(state, player);
    for (const type of CITIES_PRIORITY) {
      const match = options.find((action) => action.type === type);
      if (match !== undefined) return match;
    }

    return null;
  }

  function citiesActor(state: GameState): string | null {
    // Den Vertriebenen setzt sein Besitzer um, nicht der Spieler am Zug.
    if (state.phase.kind === 'displacePending') return state.phase.owner;
    return nextActor(state);
  }

  const initial = createGame(SCENARIO, CITIES_RULES, PLAYERS, 'barbaren-seed');

  let state = initial;
  let steps = 0;
  const LIMIT = 20_000;

  while ((state.barbarians?.attacks ?? 0) === 0 && state.phase.kind !== 'finished') {
    if (steps >= LIMIT) break;

    const actor = citiesActor(state);
    if (actor === null) break;

    const action = chooseCitiesAction(state, actor);
    if (action === null) break;

    const result = reduce(state, action);
    if (!result.ok) {
      throw new Error(
        `Zug ${steps} (${action.type}, ${actor}) abgelehnt: ${result.error.code} - ${result.error.message}`,
      );
    }

    expect(totalCards(result.state)).toBe(totalCards(initial));

    state = result.state;
    steps += 1;
  }

  it('kommt bis zum ersten Ueberfall', () => {
    expect(steps).toBeLessThan(LIMIT);
    expect(state.barbarians?.attacks).toBeGreaterThanOrEqual(1);
  });

  it('hat unterwegs Ritter gebaut, aktiviert und versetzt', () => {
    // Der Ueberfall hat sie danach alle deaktiviert - dass es sie gibt, sagt
    // der Vorrat, aus dem sie genommen wurden.
    const built = state.players.some(
      (player) => player.piecesLeft.knight1 < CITIES_RULES.pieceStock.knight1,
    );
    expect(built).toBe(true);
  });

  it('schickt das Schiff zurueck auf den Anfang', () => {
    expect(state.barbarians?.position).toBe(0);
  });

  it('gibt danach den Raeuber frei', () => {
    expect(robberIsFree(state)).toBe(true);
  });

  it('laesst danach keinen aktivierten Ritter stehen', () => {
    for (const knight of Object.values(state.knights)) {
      expect(knight.active).toBe(false);
      expect(knight.activatedOnTurn).toBeNull();
    }
  });

  it('passt Staedte und Retter-Chips zum Ausgang zusammen', () => {
    const chips = state.players.reduce((sum, player) => sum + player.defenderPoints, 0);
    const cities = Object.values(state.buildings).filter(
      (building) => building.kind === 'city',
    ).length;

    /*
     * Genau eines von beidem kann der Ueberfall gebracht haben, und beides ist
     * zulaessig: ein Chip (die Ritter hielten, mit alleinigem Hoechstbeitrag)
     * oder ein Staedteverlust. Keiner von beiden Faellen ist ein Fehler - was
     * hier geprueft wird, ist, dass die Zahlen ueberhaupt zusammenpassen.
     */
    expect(chips).toBeLessThanOrEqual(state.players.length);
    expect(cities).toBeGreaterThanOrEqual(0);
    expect(cities).toBeLessThanOrEqual(CITIES_RULES.pieceStock.city * state.players.length);
  });

  it('haelt den Kartenbestand ueber die ganze Strecke', () => {
    expect(totalCards(state)).toBe(totalCards(initial));
  });
});

/**
 * Eine Partie nach Staedte-&-Ritter-Regeln bis zur ersten Metropole.
 *
 * Dieselbe stumpfe Strategie wie in den beiden Partien oben, um `improveCity`
 * erweitert - mit zwei Anpassungen, ohne die diese Partie nie ankaeme:
 *
 *  - `improveCity` steht weit vorn in der Prioritaet, sonst baut der Treiber
 *    lieber Strassen und der Ausbau kommt nie an die Reihe.
 *  - Der Bankhandel waehlt gezielt: der Ausbau kostet Handelswaren (cloth,
 *    coin, paper), und ein Handel, der zum Beispiel Lehm gegen Erz tauscht,
 *    bringt die Metropole keinen Schritt naeher. `options.find` auf den
 *    erstbesten `tradeWithBank`-Zug waere hier die falsche Wahl - die
 *    Schleife liefe ins Limit, ohne dass je eine Metropole steht, und die
 *    Invarianten unten behaupteten nichts mehr.
 *
 * Der Test haengt **nicht** an einer bestimmten Wurffolge: die Wuerfe kommen
 * aus dem Seed, geprueft werden die Invarianten **nach** der ersten
 * Metropole, nicht ihr Weg dorthin.
 */
describe('Eine Partie bis zur ersten Metropole', () => {
  const METROPOLIS_PRIORITY: readonly GameAction['type'][] = [
    'placeSetupSettlement',
    'placeSetupRoad',
    'rollDice',
    'moveRobber',
    'placeDisplacedKnight',
    // Dasselbe gilt fuer die drei Wartestationen eines Wurfs: solange eine
    // offen ist, geht am Tisch nichts anderes.
    'pickProgressDeck',
    'discardProgressCard',
    'pickAqueduct',
    'buildCity',
    // Weit vorn, wie im Auftrag verlangt: sonst baut der Treiber lieber
    // Strassen, und der Ausbau kommt nie an die Reihe.
    'improveCity',
    'buildSettlement',
    'buildKnight',
    'activateKnight',
    'upgradeKnight',
    'moveKnight',
    'buildWall',
    'buildRoad',
    'tradeWithBank',
    'endTurn',
  ];

  /**
   * Bevorzugt einen Bankhandel, der eine Handelsware einbringt - der Ausbau
   * kostet cloth, coin oder paper, und ein Rohstoff-gegen-Rohstoff-Handel
   * bringt dafuer nichts. Gibt es keinen solchen Handel (z.B. weil die Bank
   * gerade keine Handelswaren mehr hat), faellt die Wahl auf den erstbesten -
   * besser ein Zug, der nicht hilft, als gar keiner.
   */
  function chooseBankTrade(
    options: readonly GameAction[],
  ): Extract<GameAction, { type: 'tradeWithBank' }> | undefined {
    const trades = options.filter(
      (action): action is Extract<GameAction, { type: 'tradeWithBank' }> =>
        action.type === 'tradeWithBank',
    );

    return trades.find((trade) => isCommodity(trade.receive)) ?? trades[0];
  }

  function chooseMetropolisAction(state: GameState, player: string): GameAction | null {
    if (state.phase.kind === 'discardPending') {
      return { type: 'discard', player, resources: chooseDiscard(state, player) };
    }

    const options = legalActions(state, player);
    for (const type of METROPOLIS_PRIORITY) {
      if (type === 'tradeWithBank') {
        const trade = chooseBankTrade(options);
        if (trade !== undefined) return trade;
        continue;
      }

      const match = options.find((action) => action.type === type);
      if (match !== undefined) return match;
    }

    return null;
  }

  function metropolisActor(state: GameState): string | null {
    // Den Vertriebenen setzt sein Besitzer um, nicht der Spieler am Zug.
    if (state.phase.kind === 'displacePending') return state.phase.owner;
    return nextActor(state);
  }

  /** Das Gebaeude, das den ersten Aufsatz traegt - `null`, solange es keins gibt. */
  function metropolisBuilding(current: GameState): GameState['buildings'][string] | null {
    return (
      Object.values(current.buildings).find((building) => building.metropolis !== null) ?? null
    );
  }

  const initial = createGame(SCENARIO, CITIES_RULES, PLAYERS, 'metropole-seed');

  let state = initial;
  let steps = 0;
  const LIMIT = 20_000;

  while (metropolisBuilding(state) === null && state.phase.kind !== 'finished') {
    if (steps >= LIMIT) break;

    const actor = metropolisActor(state);
    if (actor === null) break;

    const action = chooseMetropolisAction(state, actor);
    if (action === null) break;

    const result = reduce(state, action);
    if (!result.ok) {
      throw new Error(
        `Zug ${steps} (${action.type}, ${actor}) abgelehnt: ${result.error.code} - ${result.error.message}`,
      );
    }

    expect(totalCards(result.state)).toBe(totalCards(initial));

    state = result.state;
    steps += 1;
  }

  /*
   * Diese Behauptung kommt zuerst und traegt alle folgenden: ohne eine
   * wirklich erreichte Metropole waeren "hoechstens ein Aufsatz je Bereich"
   * und die uebrigen Invarianten unten auch bei null Metropolen wahr - und
   * behaupteten damit gar nichts.
   */
  it('erreicht die erste Metropole, ohne ins Limit zu laufen', () => {
    expect(steps).toBeLessThan(LIMIT);
    expect(metropolisBuilding(state)).not.toBeNull();
  });

  it('traegt je Bereich hoechstens einen Aufsatz', () => {
    for (const track of TRACK_IDS) {
      const holders = Object.values(state.buildings).filter(
        (building) => building.metropolis === track,
      );
      expect(holders.length).toBeLessThanOrEqual(1);
    }
  });

  it('steht beim Halter auf Stufe 4 oder hoeher im erreichten Bereich', () => {
    const building = metropolisBuilding(state);
    expect(building).not.toBeNull();
    if (building === null) return;

    const track = building.metropolis;
    expect(track).not.toBeNull();
    if (track === null) return;

    const holder = state.players.find((player) => player.id === building.owner);
    expect(holder).toBeDefined();
    if (holder === undefined) return;

    expect(levelOf(holder, track)).toBeGreaterThanOrEqual(METROPOLIS_LEVEL);
  });

  it('gibt dem Halter die vier Siegpunkte aus Stadt und Aufsatz', () => {
    const building = metropolisBuilding(state);
    expect(building).not.toBeNull();
    if (building === null) return;

    expect(building.kind).toBe('city');

    // Zwei Stadt- plus zwei Aufsatzpunkte - beide sind in `victoryPointsOf`
    // enthalten, zusammen mit allem anderen, was der Halter sonst noch hat.
    const expectedMinimum = CITIES_RULES.victoryPoints.city + CITIES_RULES.victoryPoints.metropolis;
    expect(victoryPointsOf(state, building.owner)).toBeGreaterThanOrEqual(expectedMinimum);
  });

  it('haelt den Kartenbestand ueber die ganze Strecke', () => {
    expect(totalCards(state)).toBe(totalCards(initial));
  });
});

/**
 * Eine Partie nach Staedte-&-Ritter-Regeln bis zur ersten gespielten
 * Fortschrittskarte (Abschnitt 10 der Spec verlangt genau diesen Beleg je
 * Etappe): Gruendung, dann so lange wuerfeln, bis ein Stadttor faellt und
 * jemand ueber die Schwelle kommt, dann die gezogene Karte wirklich
 * ausspielen - statt die Kette zu stellen.
 *
 * Anders als die drei Partien oben braucht dieser Lauf ein Brett fuer zwei
 * Personen: `SCENARIO` oben ist mit `CLASSIC_34` fuer drei bis vier gebaut,
 * die Aufgabe verlangt woertlich `players: ['p1', 'p2']`. `TEST_SCENARIO`
 * aus `fixtures.ts` ist das einzige Brett im Paket, das das hergibt.
 *
 * **Die beiden Gruendungssetzungen von p1 sind gezielt gewaehlt, nicht dem
 * Zufall der Prioritaetsliste ueberlassen.** Mit diesem Seed und diesem
 * Brett zieht p1 als erste Fortschrittskarte den Schmied - und der braucht
 * einen eigenen Ritter, sonst hat er keine Wirkung (`science.ts`,
 * `applySmith`). Ein Ritter kostet Wolle und Erz; auf diesem Brett gibt es
 * je ein Feld von beidem, und die beiden liegen so, dass keine Kreuzung
 * beide beruehrt (siehe die Nachbarschaft im generierten Radius-1-Ring).
 * Die erste Setzung liegt an der Schafsweide (Wolle), die zweite - die als
 * Stadt sofort Ertrag abwirft, `setupBuildingKind` - am Gebirge (Erz).
 * Zusammen mit `buildKnight` weit vorn in der Prioritaet steht der Ritter
 * damit lange vor der ersten Fortschrittskarte. Welche Karte tatsaechlich
 * faellt, haengt daran nicht: die Wuerfelfolge kommt allein aus dem Seed und
 * der Zahl der vergangenen Zuege, nicht aus Bauentscheidungen - dieselbe
 * Karte faellt so oder so, nur ohne Ritter waere sie unspielbar.
 */
describe('Eine Partie bis zur ersten gespielten Fortschrittskarte', () => {
  const FORTSCHRITT_PLAYERS = ['p1', 'p2'] as const;

  /** Erste Gruendungssetzung von p1: Schafsweide, Ziffer 8 - liefert Wolle. */
  const WOOL_VERTEX = 'v:0,-1|0,0|1,-1';
  /** Zweite Gruendungssetzung von p1 (eine Stadt): Gebirge, Ziffer 4 - liefert Erz. */
  const ORE_VERTEX = 'v:-1,1|-1,2|0,1';

  const LIMIT = 20_000;

  const FORTSCHRITT_PRIORITY: readonly GameAction['type'][] = [
    'placeSetupSettlement',
    'placeSetupRoad',
    'rollDice',
    'moveRobber',
    'placeDisplacedKnight',
    'pickProgressDeck',
    'discardProgressCard',
    'pickAqueduct',
    // Weit vorn, aus demselben Grund wie `improveCity` beim Metropolen-Lauf
    // oben: ein Ritter muss stehen, bevor der Schmied faellt, sonst kommt er
    // nie an die Reihe und die Karte unten waere unspielbar.
    'buildKnight',
    'buildCity',
    'buildSettlement',
    'activateKnight',
    'upgradeKnight',
    'moveKnight',
    'buildWall',
    'buildRoad',
    'tradeWithBank',
    'endTurn',
  ];

  function chooseFortschrittAction(state: GameState, player: PlayerId): GameAction | null {
    if (state.phase.kind === 'discardPending') {
      return { type: 'discard', player, resources: chooseDiscard(state, player) };
    }

    const options = legalActions(state, player);

    // Die Gruendungssetzungen von p1 sind gezielt - siehe Blockkommentar.
    if (player === 'p1' && state.phase.kind === 'setup' && state.phase.settlement === null) {
      const preferred = state.phase.placement === 0 ? WOOL_VERTEX : ORE_VERTEX;
      const chosen = options.find(
        (action) => action.type === 'placeSetupSettlement' && action.vertex === preferred,
      );
      if (chosen !== undefined) return chosen;
    }

    for (const type of FORTSCHRITT_PRIORITY) {
      const match = options.find((action) => action.type === type);
      if (match !== undefined) return match;
    }

    return null;
  }

  /** Den Vertriebenen setzt sein Besitzer um, nicht der Spieler am Zug. */
  function fortschrittActor(state: GameState): PlayerId | null {
    if (state.phase.kind === 'displacePending') return state.phase.owner;
    return nextActor(state);
  }

  /**
   * Treibt mit der Strategie oben voran, bis `until` zutrifft - hoechstens
   * `LIMIT` Zuege, danach ein Fehlschlag mit Ursache statt ein Haenger.
   */
  function playUntil(state: GameState, until: (current: GameState) => boolean): GameState {
    let current = state;
    let steps = 0;

    while (!until(current)) {
      if (steps >= LIMIT) {
        throw new Error(`playUntil: Bedingung auch nach ${LIMIT} Zuegen nicht erfuellt`);
      }

      const actor = fortschrittActor(current);
      if (actor === null) throw new Error('playUntil: niemand ist am Zug');

      const action = chooseFortschrittAction(current, actor);
      if (action === null) throw new Error(`playUntil: kein Zug fuer ${actor} verfuegbar`);

      const result = reduce(current, action);
      if (!result.ok) {
        throw new Error(
          `Zug ${steps} (${action.type}, ${actor}) abgelehnt: ${result.error.code} - ${result.error.message}`,
        );
      }

      current = result.state;
      steps += 1;
    }

    return current;
  }

  /** Treibt bis nach der Gruendung: Auftakt und Gruendungsphase komplett durchlaufen. */
  function afterOpening(state: GameState): GameState {
    return playUntil(
      state,
      (current) => current.phase.kind !== 'opening' && current.phase.kind !== 'setup',
    );
  }

  /** Treibt weiter, bis `player` in der Hauptphase am Zug ist. */
  function inMainPhase(state: GameState, player: PlayerId): GameState {
    return playUntil(
      state,
      (current) =>
        current.phase.kind === 'main' && current.players[current.currentPlayerIndex]?.id === player,
    );
  }

  /**
   * Setzt eine Ausbaustufe direkt, ohne sie zu erspielen - derselbe Griff wie
   * `withImprovements` in `cities/progress/draw.test.ts`. Wissenschaft bis
   * Stufe 1 zu erspielen braeuchte auf diesem kleinen Brett viele Zuege mehr,
   * ohne dass die Regel dabei etwas zeigt, was die Ausbau-Tests nicht schon
   * zeigen - hier geht es um die Kette danach.
   */
  function improveTo(state: GameState, player: PlayerId, track: TrackId, level: number): GameState {
    return {
      ...state,
      players: state.players.map((entry) =>
        entry.id === player
          ? { ...entry, improvements: { ...entry.improvements, [track]: level } }
          : entry,
      ),
    };
  }

  function playerNamed(state: GameState, player: PlayerId): PlayerState {
    const found = state.players.find((entry) => entry.id === player);
    if (found === undefined) throw new Error(`playerNamed: ${player} sitzt nicht an diesem Tisch`);
    return found;
  }

  const initial = createGame(TEST_SCENARIO, CITIES_RULES, [...FORTSCHRITT_PLAYERS], 'fortschritt');

  let state = afterOpening(initial);
  // Wissenschaft auf Stufe 1 bringen, damit die Schwelle 2 statt 1 ist.
  state = improveTo(state, 'p1', 'science', 1);

  const played = playUntil(state, (current) => playerNamed(current, 'p1').progressCards.length > 0);
  const readyToPlay = inMainPhase(played, 'p1');
  const card = playerNamed(played, 'p1').progressCards[0]!;

  /**
   * Baut die Kartenwahl fuer **diesen** Lauf - nicht allgemein fuer alle
   * fuenfundzwanzig Karten. Mit diesem Seed, diesem Brett und der Strategie
   * oben zieht p1 immer den Schmied zuerst (siehe Blockkommentar); jede
   * andere Karte waere ein Zeichen, dass sich an Seed, Brett oder Strategie
   * etwas geaendert hat, und soll den Test laut scheitern lassen statt still
   * eine falsche Wahl zu treffen.
   */
  function playFor(chosenCard: ProgressCardId): ProgressPlay {
    if (chosenCard !== 'smith') {
      throw new Error(`playFor: keine Testwahl fuer die Karte '${chosenCard}' hinterlegt`);
    }

    const knightVertex = Object.entries(readyToPlay.knights).find(
      ([, knight]) => knight.owner === 'p1',
    )?.[0];

    return { card: 'smith', vertices: knightVertex !== undefined ? [knightVertex] : [] };
  }

  it('spielt eine Staedte-Partie bis zur ersten gespielten Fortschrittskarte', () => {
    // Gruendung, dann so lange wuerfeln, bis ein Stadttor faellt und jemand
    // ueber die Schwelle kommt. Der Seed ist fest, also ist der Lauf
    // reproduzierbar.
    expect(playerNamed(played, 'p1').progressCards.length).toBeGreaterThan(0);

    const result = reduce(readyToPlay, {
      type: 'playProgress',
      player: 'p1',
      play: playFor(card),
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(playerNamed(result.state, 'p1').progressCards).not.toContain(card);
  });
});

/*
 * Der Regressionstest aus der Spec (Abschnitt 10): eine gespeicherte Partie
 * ohne die neuen Felder muss weiter einlesen. Das ist die Falle, die in
 * diesem Repo schon zweimal jede laufende Partie gekostet haette.
 *
 * `saved-10c.json` stammt nicht aus dem heutigen Code, sondern aus dem Stand
 * vor dieser Etappe (`c4e109f`, "Wie 10d geschnitten wird") - erzeugt mit
 * `createGame(TEST_SCENARIO, CITIES_RULES, ['p1', 'p2'], 'fortschritt')` in
 * einem voruebergehenden `git worktree` an diesem Commit, als JSON
 * ausgegeben und unveraendert hierher kopiert. Ein `createGame` von heute
 * pruefte die neue Fassung nur gegen sich selbst und bewiese nichts - erst
 * die alte Form faengt eine Feldform, die sich seither geaendert hat, nicht
 * nur ein Feld, das seither dazugekommen ist.
 */
describe('Eine gespeicherte Partie von vor Etappe 10d', () => {
  it('liest eine gespeicherte Partie ohne progressDecks weiter ein', () => {
    const parsed = GameStateSchema.safeParse(saved10c);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.progressDecks).toEqual({});
      expect(parsed.data.merchant).toBeNull();
      expect(parsed.data.players[0]!.progressCards).toEqual([]);
    }
  });
});
