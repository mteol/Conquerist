import { describe, expect, it } from 'vitest';
import { CLASSIC_34 } from '../scenario/blueprints/classic34.js';
import { generateScenario } from '../scenario/generator.js';
import { CLASSIC_RULES } from '../rules/ruleset.js';
import { seatColorAt } from '../seats.js';
import {
  ADJACENT_VERTEX,
  CENTER_EDGE,
  CENTER_VERTEX,
  FAR_VERTEX,
  HARBOR3_VERTEX,
  NEXT_EDGE,
  gameWithCities,
  giving,
  testGame,
} from './fixtures.js';
import { createGame, setupPlayer } from './setup.js';
import { legalActions } from './legal.js';
import { reduce } from './reducer.js';
import { countCards } from './cards.js';
import { PlayerViewSchema, playerViewOf } from './playerView.js';
import type { GameState } from './state.js';

const scenario = generateScenario(CLASSIC_34, 'view-geheim');
const seats = ['p1', 'p2', 'p3'].map((id, index) => ({
  id,
  name: `Spieler ${index + 1}`,
  color: seatColorAt(index),
}));

/** Eine Partie bis nach der Gruendung - dann haben alle Karten auf der Hand. */
function afterSetup(): GameState {
  let state = createGame(
    scenario,
    CLASSIC_RULES,
    seats.map((seat) => seat.id),
    'view-geheim',
  );

  while (state.phase.kind === 'setup') {
    const result = reduce(state, legalActions(state, setupPlayer(state)!)[0]!);
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;
  }

  return state;
}

/** Sammelt alle Schluessel eines Objektbaums - rekursiv, ohne Hinsehen. */
function allKeys(value: unknown, found: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) allKeys(item, found);
    return found;
  }
  if (typeof value === 'object' && value !== null) {
    for (const [key, inner] of Object.entries(value)) {
      found.add(key);
      allKeys(inner, found);
    }
  }
  return found;
}

describe('PlayerView', () => {
  it('gibt den Zufallszustand nirgends heraus', () => {
    const state = afterSetup();
    const view = playerViewOf(state, 'p1', seats, 7);

    // Rekursiv geprueft, nicht an der obersten Ebene: wer den RNG-Zustand
    // kennt, rechnet jeden kuenftigen Wuerfelwurf voraus.
    expect(allKeys(view).has('rng')).toBe(false);
    expect(JSON.stringify(view)).not.toContain('"rng"');
  });

  it('zeigt die eigenen Karten vollstaendig', () => {
    const state = afterSetup();
    const view = playerViewOf(state, 'p2', seats, 1);
    const own = view.players.find((player) => player.id === 'p2')!;

    expect(own.resources).toEqual(state.players[1]!.resources);
    expect(own.cardCount).toBe(countCards(state.players[1]!.resources));
  });

  it('zeigt von fremden Haenden nur die Anzahl', () => {
    const state = afterSetup();
    const view = playerViewOf(state, 'p2', seats, 1);

    for (const player of view.players) {
      if (player.id === 'p2') continue;
      expect(player.resources).toBeNull();
    }
  });

  it('luegt nicht - die Anzahlen stimmen mit dem echten Zustand ueberein', () => {
    const state = afterSetup();
    const view = playerViewOf(state, 'p1', seats, 1);

    view.players.forEach((player, index) => {
      expect(player.cardCount).toBe(countCards(state.players[index]!.resources));
    });
  });

  it('uebernimmt Namen und Farbe aus den Sitzen', () => {
    const view = playerViewOf(afterSetup(), 'p1', seats, 1);
    expect(view.players.map((player) => player.name)).toEqual([
      'Spieler 1',
      'Spieler 2',
      'Spieler 3',
    ]);
    expect(view.players[0]!.color).toBe(seatColorAt(0));
  });

  it('haelt das eigene Schema ein', () => {
    const view = playerViewOf(afterSetup(), 'p3', seats, 42);
    expect(PlayerViewSchema.safeParse(view).success).toBe(true);
    expect(view.you).toBe('p3');
    expect(view.version).toBe(42);
  });

  it('weist einen Zuschauer ab, der nicht am Tisch sitzt', () => {
    expect(() => playerViewOf(afterSetup(), 'fremder', seats, 1)).toThrow(RangeError);
  });

  it('zeigt von fremden Entwicklungskarten nur die Anzahl', () => {
    const state = afterSetup();
    const withCards: GameState = {
      ...state,
      players: state.players.map((entry, index) => ({
        ...entry,
        developmentCards:
          index === 0
            ? [{ id: 'knight' as const, boughtOnTurn: 0 }]
            : [
                { id: 'victoryPoint' as const, boughtOnTurn: 0 },
                { id: 'monopoly' as const, boughtOnTurn: 0 },
              ],
      })),
    };

    const view = playerViewOf(withCards, 'p1', seats, 1);

    // Wer sieht, dass jemand einen Ritter haelt, weiss, dass sein Raeuber
    // gleich weiterzieht.
    expect(view.players[0]!.developmentCards).toHaveLength(1);
    expect(view.players[1]!.developmentCards).toBeNull();
    // Abzaehlbar ist die Anzahl trotzdem - sie liegen sichtbar verdeckt da.
    expect(view.players[1]!.developmentCount).toBe(2);
  });

  it('verraet verdeckte Siegpunktkarten nicht ueber den Punktestand', () => {
    const state = afterSetup();
    const withCards: GameState = {
      ...state,
      players: state.players.map((entry, index) => ({
        ...entry,
        developmentCards: index === 1 ? [{ id: 'victoryPoint' as const, boughtOnTurn: 0 }] : [],
      })),
    };

    const own = playerViewOf(withCards, 'p2', seats, 1);
    const foreign = playerViewOf(withCards, 'p1', seats, 1);

    // p2 sieht seinen eigenen Punkt, p1 sieht ihn nicht - sonst waere die
    // Karte ueber die Differenz verraten.
    expect(own.players[1]!.victoryPoints).toBeGreaterThan(foreign.players[1]!.victoryPoints);
  });

  it('deckt die Siegpunkte auf, sobald die Partie vorbei ist', () => {
    const state = afterSetup();
    const withCards: GameState = {
      ...state,
      phase: { kind: 'finished', winner: 'p2' },
      players: state.players.map((entry, index) => ({
        ...entry,
        developmentCards: index === 1 ? [{ id: 'victoryPoint' as const, boughtOnTurn: 0 }] : [],
      })),
    };

    const own = playerViewOf(withCards, 'p2', seats, 1);
    const foreign = playerViewOf(withCards, 'p1', seats, 1);

    /*
     * Vorher waere die Endabrechnung in sich widerspruechlich gewesen: der
     * Sieger stand bei den anderen mit weniger Punkten da, als das Ziel
     * verlangt - es fehlten genau die Karten, mit denen er gewonnen hat.
     */
    expect(foreign.players[1]!.victoryPoints).toBe(own.players[1]!.victoryPoints);
  });

  it('gibt den Entwicklungsstapel nicht heraus, nur seine Groesse', () => {
    const state = afterSetup();
    const view = playerViewOf({ ...state, deck: ['knight', 'monopoly'] }, 'p1', seats, 1);

    // Nur die Groesse. Die Reihenfolge ist das Geheimnis: wer sie kennt, weiss
    // vor dem Kauf, was er zieht.
    expect(view.deckLeft).toBe(2);
    expect(allKeys(view).has('deck')).toBe(false);

    // Dass „monopoly" im JSON vorkommt, ist dagegen in Ordnung: das RuleSet
    // nennt die Stapelgroessen, und wie viele Karten es je Art gibt, steht in
    // der Anleitung.
    expect(view.rules.developmentDeck.monopoly).toBe(2);
  });
});

describe('Offene Fortschrittskarten in der Sicht', () => {
  it('zeigt die zwei Siegpunktkarten auch den Mitspielern', () => {
    const state = gameWithCities();
    const withCards: GameState = {
      ...state,
      players: state.players.map((player) =>
        player.id === 'p1'
          ? { ...player, progressCards: ['crane'], openProgressCards: ['printer'] }
          : player,
      ),
    };

    const view = playerViewOf(withCards, 'p2', seats, 1);
    const p1 = view.players.find((entry) => entry.id === 'p1');

    expect(p1?.openProgressCards).toEqual(['printer']);
  });

  it('zeigt nur die Anzahl der verdeckten Fortschrittskarten', () => {
    const state = gameWithCities();
    const withCards: GameState = {
      ...state,
      players: state.players.map((player) =>
        player.id === 'p1' ? { ...player, progressCards: ['crane', 'mining'] } : player,
      ),
    };

    const view = playerViewOf(withCards, 'p2', seats, 1);
    const p1 = view.players.find((entry) => entry.id === 'p1');

    expect(p1?.progressCardCount).toBe(2);
  });

  it('geht durch das eigene Schema', () => {
    const state = gameWithCities();
    const withCards: GameState = {
      ...state,
      players: state.players.map((player) =>
        player.id === 'p1' ? { ...player, openProgressCards: ['constitution'] } : player,
      ),
    };

    expect(() => PlayerViewSchema.parse(playerViewOf(withCards, 'p1', seats, 1))).not.toThrow();
  });
});

describe('Verdeckte Fortschrittskarten in der eigenen Hand', () => {
  it('zeigt die eigene Fortschrittskartenhand vollstaendig', () => {
    const state = gameWithCities();
    const withCards: GameState = {
      ...state,
      players: state.players.map((player) =>
        player.id === 'p1' ? { ...player, progressCards: ['crane', 'mining'] } : player,
      ),
    };

    const view = playerViewOf(withCards, 'p1', seats, 1);
    const own = view.players.find((player) => player.id === 'p1')!;

    expect(own.progressCards).toEqual(['crane', 'mining']);
  });

  it('zeigt von fremden Fortschrittskartenhaenden nichts', () => {
    const state = gameWithCities();
    const withCards: GameState = {
      ...state,
      players: state.players.map((player) =>
        player.id === 'p1' ? { ...player, progressCards: ['diplomat', 'saboteur'] } : player,
      ),
    };

    const view = playerViewOf(withCards, 'p2', seats, 1);
    const foreign = view.players.find((player) => player.id === 'p1')!;

    // Weder die Karten noch ihre Namen duerfen die Sicht des Mitspielers
    // erreichen - nur die Anzahl bleibt (progressCardCount).
    //
    // Geprueft an `view.players` und nicht am ganzen `view`: `rules.progressDecks`
    // nennt ohnehin jede Kartenart des Spiels (die volle Stapelzusammensetzung
    // ist oeffentlich) - eine Suche ueber die ganze Sicht faende "diplomat"
    // immer, egal ob die Hand leckt.
    expect(foreign.progressCards).toBeNull();
    expect(foreign.progressCardCount).toBe(2);
    expect(JSON.stringify(view.players)).not.toContain('diplomat');
    expect(JSON.stringify(view.players)).not.toContain('saboteur');
  });

  it('haelt das eigene Schema ein', () => {
    const state = gameWithCities();
    const withCards: GameState = {
      ...state,
      players: state.players.map((player) =>
        player.id === 'p1' ? { ...player, progressCards: ['crane'] } : player,
      ),
    };

    expect(() => PlayerViewSchema.parse(playerViewOf(withCards, 'p1', seats, 1))).not.toThrow();
  });
});

describe('Die drei Fortschrittsstapel in der Sicht', () => {
  it('nennt nur die Resthoehe der drei Stapel', () => {
    const state = gameWithCities({
      progressDecks: {
        science: ['mining', 'irrigation'],
        trade: ['merchant'],
        politics: [],
      },
    });

    const view = playerViewOf(state, 'p1', seats, 1);

    expect(view.progressDeckSizes).toEqual({ science: 2, trade: 1, politics: 0 });
  });

  it('gibt den Inhalt und die Reihenfolge der Stapel nirgends heraus', () => {
    const state = gameWithCities({
      progressDecks: {
        science: ['mining', 'irrigation'],
        trade: ['merchant'],
        // 'bishop', nicht 'diplomat': seit dieser Etappe heisst ein eigenes
        // Sichtfeld `diplomatTargets`, und der Teilstring-Test unten faende
        // sich selbst - ein Feldname ist kein Leck des Stapelinhalts.
        politics: ['bishop', 'saboteur'],
      },
    });

    const view = playerViewOf(state, 'p1', seats, 1);

    // Nur die Groesse. Die Reihenfolge ist das Geheimnis - dieselbe
    // Begruendung wie bei `deckLeft` fuer den Entwicklungskartenstapel.
    expect(Object.keys(view)).not.toContain('progressDecks');

    /*
     * Der JSON-Vergleich laeuft ohne `rules`: `rules.progressDecks` nennt die
     * volle Zusammensetzung jedes Stapels (wie viele Karten jeder Art es im
     * Spiel insgesamt gibt) - das ist oeffentliches Regelwissen, keine
     * Reihenfolge der tatsaechlichen Stapel, und enthaelt deshalb ohnehin
     * jeden Kartennamen. Ausserhalb von `rules` duerfen sie nicht auftauchen.
     */
    const withoutRules = Object.fromEntries(
      Object.entries(view).filter(([key]) => key !== 'rules'),
    );
    expect(JSON.stringify(withoutRules)).not.toContain('bishop');
    expect(JSON.stringify(withoutRules)).not.toContain('saboteur');
    expect(JSON.stringify(withoutRules)).not.toContain('irrigation');
  });

  it('haelt das eigene Schema ein', () => {
    const state = gameWithCities({
      progressDecks: { science: ['mining'], trade: [], politics: [] },
    });

    expect(() => PlayerViewSchema.parse(playerViewOf(state, 'p1', seats, 1))).not.toThrow();
  });
});

describe('Alchemie in der Sicht', () => {
  it('zeigt die vorab gesetzten Augenzahlen jedem Spieler - sie wurden angesagt', () => {
    const state = gameWithCities({ alchemistRoll: { first: 3, second: 5 } });

    const own = playerViewOf(state, 'p1', seats, 1);
    const foreign = playerViewOf(state, 'p2', seats, 1);

    expect(own.alchemistRoll).toEqual({ first: 3, second: 5 });
    expect(foreign.alchemistRoll).toEqual({ first: 3, second: 5 });
  });

  it('bleibt leer ohne aktive Alchemie', () => {
    const view = playerViewOf(gameWithCities(), 'p1', seats, 1);
    expect(view.alchemistRoll).toBeNull();
  });
});

describe('Der Kranrabatt in der Sicht', () => {
  it('zeigt den Kranrabatt jedem Spieler', () => {
    const state = gameWithCities({ craneDiscount: ['science'] });

    const own = playerViewOf(state, 'p1', seats, 1);
    const foreign = playerViewOf(state, 'p2', seats, 1);

    expect(own.craneDiscount).toEqual(['science']);
    expect(foreign.craneDiscount).toEqual(['science']);
  });

  it('bleibt leer ohne aktiven Kranrabatt', () => {
    const view = playerViewOf(gameWithCities(), 'p1', seats, 1);
    expect(view.craneDiscount).toEqual([]);
  });
});

describe('Ausbaustufen in der Sicht', () => {
  it('traegt improvements bei jedem Spieler, nicht nur beim Empfaenger', () => {
    const state = afterSetup();
    const withLevels: GameState = {
      ...state,
      players: state.players.map((player) => {
        if (player.id === 'p1') return { ...player, improvements: { trade: 2 } };
        if (player.id === 'p2') return { ...player, improvements: { science: 4 } };
        return player;
      }),
    };

    // p2 bekommt seine eigene Sicht - trotzdem stehen p1s Stufen mit drin.
    // Wer die Tableaus der anderen nicht sieht, sieht die Metropole nicht
    // kommen.
    const view = playerViewOf(withLevels, 'p2', seats, 1);

    expect(view.players.find((player) => player.id === 'p2')?.improvements).toEqual({
      science: 4,
    });
    expect(view.players.find((player) => player.id === 'p1')?.improvements).toEqual({
      trade: 2,
    });
  });
});

describe('canOfferTrade in der Sicht', () => {
  it('steht beim Spieler am Zug mit Karten, bei den anderen nicht', () => {
    const state = afterSetup();
    const current = state.players[state.currentPlayerIndex]!.id;
    const other = state.players.find((player) => player.id !== current)!.id;

    // Nach der Gruendung hat jeder Karten - der am Zug darf anbieten.
    expect(playerViewOf(state, current, seats, 0).canOfferTrade).toBe(state.phase.kind === 'main');
    expect(playerViewOf(state, other, seats, 0).canOfferTrade).toBe(false);
  });
});

describe('das Barbarenschiff in der Sicht', () => {
  it('steht offen da - jeder sieht, wie nah die Gefahr ist', () => {
    const view = playerViewOf(gameWithCities(), 'p1', seats, 1);

    expect(view.barbarians).toEqual({ position: 0, attacks: 0 });
  });

  it('fehlt an einem Tisch ohne Erweiterung', () => {
    expect(playerViewOf(testGame(), 'p1', seats, 1).barbarians).toBeNull();
  });

  /*
   * Eine Sicht aus einer Partie von vor der Erweiterung kennt das Feld nicht.
   * Ohne Vorgabe scheiterte sie am Schema - dieselbe Falle wie beim RuleSet.
   */
  it('ergaenzt sich in einer gespeicherten Sicht ohne dieses Feld', () => {
    const view = playerViewOf(testGame(), 'p1', seats, 1) as Record<string, unknown>;
    delete view['barbarians'];

    expect(PlayerViewSchema.parse(view).barbarians).toBeNull();
  });
});

describe('Ritter in der Sicht', () => {
  const A = 'v:0,0|1,-1|1,0';
  const B = 'v:0,0|0,1|1,0';

  function knight(owner: string, level: 1 | 2 | 3, active: boolean) {
    return { owner, level, active, activatedOnTurn: active ? 1 : null, upgradedThisTurn: false };
  }

  const board = gameWithCities({
    knights: { [A]: knight('p1', 3, true), [B]: knight('p2', 2, false) },
  });

  it('traegt die Ritter unveraendert weiter - sie stehen offen auf dem Brett', () => {
    const view = playerViewOf(board, 'p2', seats, 1);
    expect(view.knights).toEqual(board.knights);
  });

  it('nennt die Staerke der Ritter Catans ueber alle Spieler', () => {
    // Nur der aktivierte Dreier zaehlt, der passive Zweier nicht.
    expect(playerViewOf(board, 'p1', seats, 1).defenders).toBe(3);
  });

  it('zeigt die Retter-Chips bei jedem Spieler und nicht nur beim Empfaenger', () => {
    const withChips: GameState = {
      ...board,
      players: board.players.map((player) =>
        player.id === 'p3' ? { ...player, defenderPoints: 2 } : player,
      ),
    };

    const view = playerViewOf(withChips, 'p1', seats, 1);
    expect(view.players.find((player) => player.id === 'p3')?.defenderPoints).toBe(2);
  });

  it('geht durch das eigene Schema', () => {
    expect(() => PlayerViewSchema.parse(playerViewOf(board, 'p1', seats, 1))).not.toThrow();
  });
});

describe('Ziele der Fortschrittskarten mit Angabe in der Sicht', () => {
  /*
   * Ein Tisch, an dem p1 alle sieben Karten haelt und fuer jede mindestens
   * ein Ziel hat - Ingenieur und Schmied nutzen dieselbe Stadt/denselben
   * Ritter, Diplomat und Intrige denselben Weg zur weit entfernten Kreuzung.
   * p2 haelt keine einzige der sieben Karten.
   */
  function tableWithTargets(): GameState {
    const base = gameWithCities({
      buildings: {
        [CENTER_VERTEX]: { owner: 'p1', kind: 'city', wall: false, metropolis: null },
        [HARBOR3_VERTEX]: { owner: 'p1', kind: 'settlement', wall: false, metropolis: null },
      },
      roads: { [CENTER_EDGE]: 'p1', [NEXT_EDGE]: 'p1' },
      knights: {
        [ADJACENT_VERTEX]: {
          owner: 'p1',
          level: 1,
          active: false,
          activatedOnTurn: null,
          upgradedThisTurn: false,
        },
        [FAR_VERTEX]: {
          owner: 'p2',
          level: 1,
          active: false,
          activatedOnTurn: null,
          upgradedThisTurn: false,
        },
      },
    });

    const withOre = giving(base, 'p1', { ore: 2, grain: 1 });

    return {
      ...withOre,
      players: withOre.players.map((player) => {
        if (player.id === 'p1') {
          return {
            ...player,
            progressCards: [
              'inventor',
              'engineer',
              'medicine',
              'smith',
              'roadBuilding',
              'diplomat',
              'intrigue',
            ],
          };
        }
        return player;
      }),
    };
  }

  it('zeigt dem Empfaenger seine eigenen Ziele fuer alle sieben Karten', () => {
    const view = playerViewOf(tableWithTargets(), 'p1', seats, 1);

    expect(Object.keys(view.inventorTargets).length).toBeGreaterThan(0);
    expect(view.engineerTargets.length).toBeGreaterThan(0);
    expect(view.medicineTargets.length).toBeGreaterThan(0);
    expect(Object.keys(view.smithTargets).length).toBeGreaterThan(0);
    expect(Object.keys(view.progressRoadBuildingTargets).length).toBeGreaterThan(0);
    expect(Object.keys(view.diplomatTargets).length).toBeGreaterThan(0);
    expect(view.intrigueTargets.length).toBeGreaterThan(0);
  });

  /*
   * Die Kehrseite: p2 sitzt am selben Tisch, an dem p1 fuer jede der sieben
   * Karten ein Ziel haette - p2 haelt aber keine einzige davon. Zeigte die
   * Sicht hier trotzdem Ziele, waere das ein Leck: p2 saehe, wo p1s naechster
   * Zug hinginge, oder die Sicht rechnete versehentlich fuer den falschen
   * Spieler.
   */
  it('zeigt einem Mitspieler ohne diese Karten nirgends fremde Ziele', () => {
    const view = playerViewOf(tableWithTargets(), 'p2', seats, 1);

    expect(view.inventorTargets).toEqual({});
    expect(view.engineerTargets).toEqual([]);
    expect(view.medicineTargets).toEqual([]);
    expect(view.smithTargets).toEqual({});
    expect(view.progressRoadBuildingTargets).toEqual({});
    expect(view.diplomatTargets).toEqual({});
    expect(view.intrigueTargets).toEqual([]);
  });

  it('geht durch das eigene Schema', () => {
    expect(() =>
      PlayerViewSchema.parse(playerViewOf(tableWithTargets(), 'p1', seats, 1)),
    ).not.toThrow();
  });

  /*
   * Eine Sicht aus einer gespeicherten Partie ohne diese Felder - dieselbe
   * Falle wie beim Barbarenschiff oben. `.default(...)` haelt sie lesbar.
   */
  it('ergaenzt sich in einer gespeicherten Sicht ohne diese Felder', () => {
    const view = playerViewOf(testGame(), 'p1', seats, 1) as Record<string, unknown>;
    delete view['inventorTargets'];
    delete view['engineerTargets'];
    delete view['medicineTargets'];
    delete view['smithTargets'];
    delete view['progressRoadBuildingTargets'];
    delete view['diplomatTargets'];
    delete view['intrigueTargets'];

    const parsed = PlayerViewSchema.parse(view);
    expect(parsed.inventorTargets).toEqual({});
    expect(parsed.engineerTargets).toEqual([]);
    expect(parsed.medicineTargets).toEqual([]);
    expect(parsed.smithTargets).toEqual({});
    expect(parsed.progressRoadBuildingTargets).toEqual({});
    expect(parsed.diplomatTargets).toEqual({});
    expect(parsed.intrigueTargets).toEqual([]);
  });
});
