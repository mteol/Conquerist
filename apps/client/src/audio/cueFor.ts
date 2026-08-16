import { FOREIGN_GAIN, type Cue, type Move, type Situation, type Sound } from './cues';

/**
 * Welcher Zug wie klingt.
 *
 * Rein und ohne Zustand: hinein gehen der Zug und die erhobene Lage, heraus
 * kommt eine Liste Klaenge. Damit ist die ganze Zuordnung mit Objektliteralen
 * pruefbar - ohne Spielstand, ohne DOM, ohne AudioContext.
 *
 * Stumm bleiben `endTurn` (der Zugwechsel meldet sich mit `turn.mine`, wenn er
 * mich betrifft) sowie `dropFromTrade` und `rejoinTrade` - das sind Nachrichten
 * ueber eine Verbindung, kein Zug am Tisch.
 */
export function cueFor(move: Move, situation: Situation): readonly Sound[] {
  const level = loudness(situation);
  const sounds: Sound[] = [];

  const add = (cue: Cue, note?: number): void => {
    sounds.push(note === undefined ? { cue, gain: level } : { cue, gain: level, note });
  };
  // Was mich betrifft, wird nicht gedaempft, auch wenn es von fremd kommt.
  const addMine = (cue: Cue): void => {
    sounds.push({ cue, gain: 1 });
  };

  switch (move.type) {
    case 'placeSetupRoad':
    case 'buildRoad':
      add('build.road');
      break;
    case 'placeSetupSettlement':
    case 'buildSettlement':
      add('build.settlement');
      break;
    case 'buildCity':
      add('build.city');
      break;

    case 'rollDice':
      add('dice.roll');
      if (situation.diceTotal !== null) {
        if (situation.diceTotal === 7) add('dice.seven');
        else add('dice.land', situation.diceTotal);
      }
      break;

    // Abwerfen ist dasselbe Kartenrutschen wie ein Diebstahl: Karten verlassen
    // die Hand, und der Anlass ist derselbe Raeuber.
    case 'discard':
      add('robber.steal');
      break;

    case 'moveRobber':
      add('robber.move');
      if (situation.lost > 0) addMine('robber.steal');
      break;

    case 'buyDevelopmentCard':
      add('card.buy');
      break;
    case 'playKnight':
      add('card.knight');
      break;
    case 'playRoadBuilding':
      add('card.play');
      add('build.road');
      break;
    case 'playYearOfPlenty':
    case 'playMonopoly':
      add('card.play');
      break;

    case 'tradeWithBank':
    case 'acceptTrade':
      add('trade.accept');
      break;
    case 'offerTrade':
    case 'counterTrade':
      add('trade.offer');
      break;
    /*
     * Dass ueberhaupt geantwortet wurde, ist die Nachricht - **was** geantwortet
     * wurde, steht nicht im Zug. Ein geratener Zusage- oder Absageklang waere
     * schlimmer als ein neutraler, weil er in der Haelfte der Faelle das
     * Gegenteil meldete.
     */
    case 'respondTrade':
      add('ui.confirm');
      break;
    case 'rejectCounter':
    case 'withdrawTrade':
      add('trade.reject');
      break;
    case 'timeout':
      add('trade.timeout');
      break;

    case 'dropFromTrade':
    case 'rejoinTrade':
    case 'endTurn':
      break;
  }

  if (situation.gained > 0) addMine('gain.self');
  if (situation.mustDiscard) addMine('discard.required');
  if (situation.becameMyTurn) addMine('turn.mine');
  if (situation.finished) addMine('game.over');

  return sounds;
}

function loudness(situation: Situation): number {
  if (!situation.foreign) return 1;

  const concerns =
    situation.offerToMe || situation.lost > 0 || situation.becameMyTurn || situation.finished;

  return concerns ? 1 : FOREIGN_GAIN;
}
