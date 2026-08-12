import { describe, expect, it } from 'vitest';

import { deadlineOf } from './deadline.js';
import { RuleViolationCode } from './errors.js';
import { giving, hand, testGame } from './fixtures.js';
import {
  applyAcceptTrade,
  applyCounterTrade,
  applyDropFromTrade,
  applyOfferTrade,
  applyRejoinTrade,
  applyRespondTrade,
  applyTimeout,
  applyWithdrawTrade,
  awaitsResponse,
  canAcceptTrade,
  canCounterTrade,
  canOfferAnything,
  canOfferTrade,
  canRespondTrade,
  canTimeout,
  hasAutomaticDecline,
  termsFor,
} from './playerTrade.js';
import { reduce } from './reducer.js';
import type { GameState } from './state.js';

/** p1 ist am Zug und hat die genannten Karten. */
function offerer(resources: Record<string, number>): GameState {
  return giving(testGame(), 'p1', resources);
}

const TWO_LUMBER = hand({ lumber: 2 });
const ONE_ORE = hand({ ore: 1 });

describe('canOfferTrade', () => {
  it('nimmt ein Angebot an, das der Anbieter decken kann', () => {
    expect(canOfferTrade(offerer({ lumber: 3 }), 'p1', TWO_LUMBER, ONE_ORE)).toBeNull();
  });

  it('lehnt eine leere Seite ab', () => {
    const state = offerer({ lumber: 3 });

    expect(canOfferTrade(state, 'p1', TWO_LUMBER, hand())?.code).toBe(
      RuleViolationCode.INVALID_TRADE,
    );
    expect(canOfferTrade(state, 'p1', hand(), ONE_ORE)?.code).toBe(RuleViolationCode.INVALID_TRADE);
  });

  it('lehnt dieselbe Sorte auf beiden Seiten ab', () => {
    const state = offerer({ lumber: 3 });

    expect(canOfferTrade(state, 'p1', TWO_LUMBER, hand({ lumber: 1, ore: 1 }))?.code).toBe(
      RuleViolationCode.INVALID_TRADE,
    );
  });

  it('lehnt ab, was der Anbieter nicht hat', () => {
    expect(canOfferTrade(offerer({ lumber: 1 }), 'p1', TWO_LUMBER, ONE_ORE)?.code).toBe(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
    );
  });

  it('lehnt ab, wer nicht am Zug ist', () => {
    expect(canOfferTrade(offerer({ lumber: 3 }), 'p2', TWO_LUMBER, ONE_ORE)?.code).toBe(
      RuleViolationCode.NOT_YOUR_TURN,
    );
  });
});

describe('canOfferAnything', () => {
  it('stimmt zu, solange der Spieler am Zug ueberhaupt eine Karte hat', () => {
    expect(canOfferAnything(offerer({ lumber: 1 }), 'p1')).toBe(true);
  });

  it('verneint bei leerer Hand und bei fremdem Zug', () => {
    expect(canOfferAnything(offerer({}), 'p1')).toBe(false);
    expect(canOfferAnything(offerer({ lumber: 3 }), 'p2')).toBe(false);
  });
});

describe('applyOfferTrade', () => {
  it('oeffnet die Phase mit leeren Antworten und einer Frist aus dem Regelwerk', () => {
    const result = applyOfferTrade(offerer({ lumber: 3 }), 'p1', TWO_LUMBER, ONE_ORE, 1_000);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toEqual({
      kind: 'tradePending',
      offer: { from: 'p1', give: TWO_LUMBER, want: ONE_ORE },
      responses: {},
      expiresAt: 1_000 + result.state.rules.tradeOfferMs,
    });
  });

  it('nimmt dem Anbieter nichts weg - getauscht wird erst beim Zuschlag', () => {
    const result = applyOfferTrade(offerer({ lumber: 3 }), 'p1', TWO_LUMBER, ONE_ORE, 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0]!.resources.lumber).toBe(3);
  });
});

describe('das offene Angebot sperrt den Zug', () => {
  function withOffer(): GameState {
    const result = applyOfferTrade(offerer({ lumber: 3 }), 'p1', TWO_LUMBER, ONE_ORE, 0);
    if (!result.ok) throw new Error('Angebot wurde abgelehnt');
    return result.state;
  }

  it('nimmt keinen Zugwechsel an, solange das Angebot liegt', () => {
    const result = reduce(withOffer(), { type: 'endTurn', player: 'p1' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(RuleViolationCode.WRONG_PHASE);
  });

  it('nimmt kein zweites Angebot an', () => {
    const result = reduce(withOffer(), {
      type: 'offerTrade',
      player: 'p1',
      give: TWO_LUMBER,
      want: ONE_ORE,
      at: 0,
    });

    expect(result.ok).toBe(false);
  });
});

/** Ein offenes Angebot: p1 bietet 2 Holz fuer 1 Erz, p2 und p3 koennen zahlen. */
function tableWithOffer(): GameState {
  const rich = giving(giving(offerer({ lumber: 3 }), 'p2', { ore: 2 }), 'p3', { ore: 2 });
  const result = applyOfferTrade(rich, 'p1', TWO_LUMBER, ONE_ORE, 0);
  if (!result.ok) throw new Error('Angebot wurde abgelehnt');
  return result.state;
}

describe('canRespondTrade', () => {
  it('laesst einen Mitspieler zusagen, der zahlen kann', () => {
    expect(canRespondTrade(tableWithOffer(), 'p2', 'accepted')).toBeNull();
  });

  it('laesst jeden ablehnen, auch ohne die verlangten Karten', () => {
    const poor = giving(tableWithOffer(), 'p2', {});

    expect(canRespondTrade(poor, 'p2', 'declined')).toBeNull();
  });

  it('sperrt die Zusage dessen, der nicht zahlen kann', () => {
    const poor = giving(tableWithOffer(), 'p2', {});

    expect(canRespondTrade(poor, 'p2', 'accepted')?.code).toBe(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
    );
  });

  it('laesst den Anbieter nicht auf sein eigenes Angebot antworten', () => {
    expect(canRespondTrade(tableWithOffer(), 'p1', 'accepted')?.code).toBe(
      RuleViolationCode.NOT_THE_OFFERER,
    );
  });

  it('nimmt keine zweite Antwort an', () => {
    const once = applyRespondTrade(tableWithOffer(), 'p2', 'declined');
    if (!once.ok) throw new Error('erste Antwort wurde abgelehnt');

    expect(canRespondTrade(once.state, 'p2', 'accepted')?.code).toBe(
      RuleViolationCode.ALREADY_RESPONDED,
    );
  });
});

describe('das Angebot verfaellt, wenn alle von Hand ablehnen', () => {
  it('bleibt offen, solange noch jemand ueberlegt', () => {
    const first = applyRespondTrade(tableWithOffer(), 'p2', 'declined');
    if (!first.ok) throw new Error('Antwort wurde abgelehnt');

    expect(first.state.phase.kind).toBe('tradePending');
  });

  it('geht zurueck in die Hauptphase, sobald der letzte ablehnt', () => {
    const first = applyRespondTrade(tableWithOffer(), 'p2', 'declined');
    if (!first.ok) throw new Error('Antwort wurde abgelehnt');
    const second = applyRespondTrade(first.state, 'p3', 'declined');
    if (!second.ok) throw new Error('Antwort wurde abgelehnt');

    expect(second.state.phase).toEqual({ kind: 'main' });
  });

  it('bleibt offen, wenn jemand zugesagt hat', () => {
    const first = applyRespondTrade(tableWithOffer(), 'p2', 'accepted');
    if (!first.ok) throw new Error('Antwort wurde abgelehnt');
    const second = applyRespondTrade(first.state, 'p3', 'declined');
    if (!second.ok) throw new Error('Antwort wurde abgelehnt');

    expect(second.state.phase.kind).toBe('tradePending');
  });
});

describe('awaitsResponse', () => {
  it('gilt fuer Mitspieler ohne Antwort und fuer den Anbieter nie', () => {
    const state = tableWithOffer();

    expect(awaitsResponse(state, 'p2')).toBe(true);
    expect(awaitsResponse(state, 'p1')).toBe(false);
  });
});

describe('canCounterTrade', () => {
  it('nimmt ein Gegenangebot an, das der Konternde decken kann', () => {
    expect(
      canCounterTrade(tableWithOffer(), 'p2', hand({ ore: 1 }), hand({ lumber: 3 })),
    ).toBeNull();
  });

  it('lehnt ein Gegenangebot ab, das der Konternde nicht decken kann', () => {
    expect(
      canCounterTrade(tableWithOffer(), 'p2', hand({ ore: 5 }), hand({ lumber: 3 }))?.code,
    ).toBe(RuleViolationCode.INSUFFICIENT_RESOURCES);
  });

  it('prueft dieselbe Form wie beim Angebot', () => {
    expect(canCounterTrade(tableWithOffer(), 'p2', hand({ ore: 1 }), hand())?.code).toBe(
      RuleViolationCode.INVALID_TRADE,
    );
  });

  /*
   * Ob der Anbieter das Gegenangebot bezahlen koennte, wird hier NICHT geprueft:
   * eine Ablehnung aus diesem Grund verriete dem Konternden etwas ueber die
   * verdeckte Hand des Anbieters. Geprueft wird es beim Zuschlag.
   */
  it('fragt nicht, ob der Anbieter zahlen koennte', () => {
    const brokeOfferer = giving(tableWithOffer(), 'p1', { lumber: 2 });

    expect(canCounterTrade(brokeOfferer, 'p2', hand({ ore: 1 }), hand({ lumber: 9 }))).toBeNull();
  });
});

describe('applyCounterTrade', () => {
  it('traegt das Gegenangebot als Antwort ein und setzt die Frist neu', () => {
    const state = tableWithOffer();
    const before = state.phase.kind === 'tradePending' ? state.phase.expiresAt : 0;

    const result = applyCounterTrade(state, 'p2', hand({ ore: 1 }), hand({ lumber: 3 }), 30_000);

    expect(result.ok).toBe(true);
    if (!result.ok || result.state.phase.kind !== 'tradePending') return;
    expect(result.state.phase.responses.p2).toEqual({
      kind: 'countered',
      give: hand({ ore: 1 }),
      want: hand({ lumber: 3 }),
    });
    expect(result.state.phase.expiresAt).toBe(30_000 + result.state.rules.tradeOfferMs);
    expect(result.state.phase.expiresAt).toBeGreaterThan(before);
  });

  it('haelt das Angebot offen, auch wenn alle anderen abgelehnt haben', () => {
    const declined = applyRespondTrade(tableWithOffer(), 'p3', 'declined');
    if (!declined.ok) throw new Error('Antwort wurde abgelehnt');

    const result = applyCounterTrade(
      declined.state,
      'p2',
      hand({ ore: 1 }),
      hand({ lumber: 3 }),
      0,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase.kind).toBe('tradePending');
  });
});

function resourcesOf(state: GameState, id: string) {
  return state.players.find((player) => player.id === id)!.resources;
}

describe('acceptTrade auf eine Zusage', () => {
  function accepted(): GameState {
    const answered = applyRespondTrade(tableWithOffer(), 'p2', 'accepted');
    if (!answered.ok) throw new Error('Antwort wurde abgelehnt');
    return answered.state;
  }

  it('bewegt genau die Mengen des Angebots', () => {
    const result = applyAcceptTrade(accepted(), 'p1', 'p2');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(resourcesOf(result.state, 'p1')).toEqual(hand({ lumber: 1, ore: 1 }));
    expect(resourcesOf(result.state, 'p2')).toEqual(hand({ lumber: 2, ore: 1 }));
  });

  it('laesst die Bank unberuehrt - das ist kein Bankgeschaeft', () => {
    const before = accepted();
    const result = applyAcceptTrade(before, 'p1', 'p2');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.bank).toEqual(before.bank);
  });

  it('gibt den Zug zurueck in die Hauptphase', () => {
    const result = applyAcceptTrade(accepted(), 'p1', 'p2');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toEqual({ kind: 'main' });
  });

  it('nimmt nur vom Anbieter einen Zuschlag an', () => {
    expect(canAcceptTrade(accepted(), 'p3', 'p2')?.code).toBe(RuleViolationCode.NOT_THE_OFFERER);
  });

  it('lehnt einen Zuschlag an jemanden ohne Zusage ab', () => {
    expect(canAcceptTrade(accepted(), 'p1', 'p3')?.code).toBe(
      RuleViolationCode.PARTNER_DID_NOT_ACCEPT,
    );
  });
});

describe('acceptTrade auf ein Gegenangebot', () => {
  function countered(): GameState {
    const answered = applyCounterTrade(
      tableWithOffer(),
      'p2',
      hand({ ore: 2 }),
      hand({ lumber: 3 }),
      0,
    );
    if (!answered.ok) throw new Error('Gegenangebot wurde abgelehnt');
    return answered.state;
  }

  it('bewegt die Mengen des Gegenangebots, nicht die des Originals', () => {
    const result = applyAcceptTrade(countered(), 'p1', 'p2');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(resourcesOf(result.state, 'p1')).toEqual(hand({ ore: 2 }));
    expect(resourcesOf(result.state, 'p2')).toEqual(hand({ lumber: 3 }));
  });

  it('lehnt ab, wenn der Anbieter das Gegenangebot nicht decken kann', () => {
    const greedy = applyCounterTrade(
      tableWithOffer(),
      'p2',
      hand({ ore: 1 }),
      hand({ lumber: 9 }),
      0,
    );
    if (!greedy.ok) throw new Error('Gegenangebot wurde abgelehnt');

    expect(canAcceptTrade(greedy.state, 'p1', 'p2')?.code).toBe(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
    );
  });
});

describe('termsFor', () => {
  it('kennt bei einer Zusage die Seiten des Originalangebots', () => {
    const answered = applyRespondTrade(tableWithOffer(), 'p2', 'accepted');
    if (!answered.ok) throw new Error('Antwort wurde abgelehnt');

    expect(termsFor(answered.state, 'p2')).toEqual({
      partnerGives: ONE_ORE,
      partnerGets: TWO_LUMBER,
    });
  });
});

describe('withdrawTrade', () => {
  it('raeumt das Angebot ab, ohne etwas zu bewegen', () => {
    const before = tableWithOffer();
    const result = applyWithdrawTrade(before, 'p1');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toEqual({ kind: 'main' });
    expect(resourcesOf(result.state, 'p1')).toEqual(resourcesOf(before, 'p1'));
  });

  it('nimmt das nur vom Anbieter an', () => {
    const result = applyWithdrawTrade(tableWithOffer(), 'p2');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(RuleViolationCode.NOT_THE_OFFERER);
  });
});

describe('deadlineOf', () => {
  it('nennt Frist und Eigentuemer, solange ein Angebot laeuft', () => {
    const state = tableWithOffer();
    const expected = state.phase.kind === 'tradePending' ? state.phase.expiresAt : -1;

    expect(deadlineOf(state)).toEqual({ at: expected, owner: 'p1' });
  });

  it('nennt nichts in der Hauptphase', () => {
    expect(deadlineOf(testGame())).toBeNull();
  });
});

describe('timeout', () => {
  it('wird abgelehnt, solange die Frist laeuft', () => {
    expect(canTimeout(tableWithOffer(), 1_000)?.code).toBe(RuleViolationCode.DEADLINE_NOT_REACHED);
  });

  it('raeumt das Angebot ab, sobald die Frist um ist', () => {
    const state = tableWithOffer();
    const due = state.phase.kind === 'tradePending' ? state.phase.expiresAt : 0;

    const result = applyTimeout(state, due);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toEqual({ kind: 'main' });
  });

  it('bewegt dabei nichts', () => {
    const state = tableWithOffer();
    const due = state.phase.kind === 'tradePending' ? state.phase.expiresAt : 0;

    const result = applyTimeout(state, due);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(resourcesOf(result.state, 'p1')).toEqual(resourcesOf(state, 'p1'));
    expect(resourcesOf(result.state, 'p2')).toEqual(resourcesOf(state, 'p2'));
  });
});

describe('dropFromTrade', () => {
  it('traegt eine automatische Ablehnung ein', () => {
    const result = applyDropFromTrade(tableWithOffer(), 'p2');

    expect(result.ok).toBe(true);
    if (!result.ok || result.state.phase.kind !== 'tradePending') return;
    expect(result.state.phase.responses.p2).toEqual({ kind: 'declined', automatic: true });
  });

  it('haelt das Angebot offen, auch wenn damit alle abgelehnt haben', () => {
    const first = applyDropFromTrade(tableWithOffer(), 'p2');
    if (!first.ok) throw new Error('Abmeldung wurde abgelehnt');
    const second = applyRespondTrade(first.state, 'p3', 'declined');

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    // Eine automatische Ablehnung ist kein Nein - der Weggebrochene kann
    // zurueckkommen und noch antworten.
    expect(second.state.phase.kind).toBe('tradePending');
  });

  it('ruehrt eine Antwort von Hand nicht an', () => {
    const said = applyRespondTrade(tableWithOffer(), 'p2', 'accepted');
    if (!said.ok) throw new Error('Antwort wurde abgelehnt');

    const result = applyDropFromTrade(said.state, 'p2');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(RuleViolationCode.ALREADY_RESPONDED);
  });
});

describe('rejoinTrade', () => {
  it('nimmt die automatische Ablehnung zurueck', () => {
    const gone = applyDropFromTrade(tableWithOffer(), 'p2');
    if (!gone.ok) throw new Error('Abmeldung wurde abgelehnt');

    const result = applyRejoinTrade(gone.state, 'p2');

    expect(result.ok).toBe(true);
    if (!result.ok || result.state.phase.kind !== 'tradePending') return;
    expect(result.state.phase.responses.p2).toBeUndefined();
  });

  it('laesst eine Ablehnung von Hand stehen', () => {
    const said = applyRespondTrade(tableWithOffer(), 'p2', 'declined');
    if (!said.ok) throw new Error('Antwort wurde abgelehnt');

    const result = applyRejoinTrade(said.state, 'p2');

    expect(result.ok).toBe(false);
  });
});

describe('hasAutomaticDecline', () => {
  it('erkennt genau die automatische Ablehnung', () => {
    const gone = applyDropFromTrade(tableWithOffer(), 'p2');
    if (!gone.ok) throw new Error('Abmeldung wurde abgelehnt');

    expect(hasAutomaticDecline(gone.state, 'p2')).toBe(true);
    expect(hasAutomaticDecline(gone.state, 'p3')).toBe(false);
  });
});
