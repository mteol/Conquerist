/**
 * Warum ein Zug abgelehnt wurde.
 *
 * Der Reducer wirft nicht, er antwortet: `{ ok: false, error }`. Der Grund
 * dafuer ist praktisch - ab Etappe 4 braucht der Server einen Ablehnungsgrund
 * fuer seine Fehlerantwort, und die Oberflaeche in Etappe 3 muss "darf ich
 * das?" fragen koennen, ohne den Zug probeweise auszufuehren.
 *
 * Der `code` ist stabil und geht ueber die Leitung; der Text ist fuer Menschen
 * und darf sich aendern.
 */

export const RuleViolationCode = {
  /** Das Spiel ist vorbei. */
  GAME_OVER: 'GAME_OVER',
  /** Der Spieler ist nicht am Zug. */
  NOT_YOUR_TURN: 'NOT_YOUR_TURN',
  /** Die Aktion passt nicht zur aktuellen Phase. */
  WRONG_PHASE: 'WRONG_PHASE',
  /** Die Spieler-Id gehoert zu niemandem am Tisch. */
  UNKNOWN_PLAYER: 'UNKNOWN_PLAYER',

  /** Knoten, Kante oder Feld gehoert nicht zu diesem Brett. */
  NOT_ON_BOARD: 'NOT_ON_BOARD',
  /** Auf dem Knoten steht bereits etwas. */
  VERTEX_OCCUPIED: 'VERTEX_OCCUPIED',
  /** Ein Nachbarknoten ist bebaut - die Abstandsregel. */
  TOO_CLOSE: 'TOO_CLOSE',
  /** Auf der Kante liegt bereits eine Strasse. */
  EDGE_OCCUPIED: 'EDGE_OCCUPIED',
  /** Kein Anschluss an eigene Strassen oder Siedlungen. */
  NOT_CONNECTED: 'NOT_CONNECTED',
  /** Auf dem Knoten steht keine eigene Siedlung. */
  NOT_OWN_SETTLEMENT: 'NOT_OWN_SETTLEMENT',
  /** Auf dem Knoten steht keine eigene Stadt. */
  NOT_OWN_CITY: 'NOT_OWN_CITY',
  /** Diese Stadt hat schon eine Mauer. */
  WALL_EXISTS: 'WALL_EXISTS',

  /** Ausbauen verlangt mindestens eine eigene Stadt. */
  NEEDS_CITY: 'NEEDS_CITY',
  /** Dieser Bereich ist auf der hoechsten Stufe. */
  TRACK_MAX_LEVEL: 'TRACK_MAX_LEVEL',
  /** Dieser Ausbau bringt den Aufsatz, also fehlt die Stadt dafuer. */
  METROPOLIS_REQUIRED: 'METROPOLIS_REQUIRED',
  /** Dieser Ausbau bringt keinen Aufsatz, die genannte Stadt gehoert nicht dazu. */
  METROPOLIS_NOT_WANTED: 'METROPOLIS_NOT_WANTED',
  /** Die genannte Stadt taugt nicht: fremd, keine Stadt, oder besetzt. */
  INVALID_METROPOLIS: 'INVALID_METROPOLIS',

  /** Die Handkarten reichen nicht. */
  INSUFFICIENT_RESOURCES: 'INSUFFICIENT_RESOURCES',
  /** Der eigene Bauteilvorrat ist aufgebraucht. */
  NO_PIECES_LEFT: 'NO_PIECES_LEFT',

  /** Auf dieser Kreuzung steht kein eigener Ritter. */
  NO_KNIGHT_HERE: 'NO_KNIGHT_HERE',
  /** Dieser Ritter traegt schon einen Helm. */
  KNIGHT_ALREADY_ACTIVE: 'KNIGHT_ALREADY_ACTIVE',
  /** Ein passiver Ritter handelt nicht. */
  KNIGHT_NOT_ACTIVE: 'KNIGHT_NOT_ACTIVE',
  /** Frisch aktiviert - handeln darf er ab dem naechsten Zug. */
  KNIGHT_JUST_ACTIVATED: 'KNIGHT_JUST_ACTIVATED',
  /** Ein Maechtiger Ritter steigt nicht weiter. */
  KNIGHT_MAX_LEVEL: 'KNIGHT_MAX_LEVEL',
  /** Stark zu Maechtig verlangt die Festung (Politik, Stufe 3). */
  KNIGHT_NEEDS_FORTRESS: 'KNIGHT_NEEDS_FORTRESS',
  /** Je Zug steigt ein Ritter nur einmal. */
  KNIGHT_ALREADY_UPGRADED: 'KNIGHT_ALREADY_UPGRADED',

  /** Dorthin fuehrt kein eigener Weg. */
  KNIGHT_UNREACHABLE: 'KNIGHT_UNREACHABLE',
  /** Dort steht etwas, das sich nicht vertreiben laesst. */
  KNIGHT_TARGET_TAKEN: 'KNIGHT_TARGET_TAKEN',
  /** Der fremde Ritter dort ist mindestens ebenso stark. */
  KNIGHT_TOO_WEAK: 'KNIGHT_TOO_WEAK',
  /** Dieser Spieler setzt gerade keinen vertriebenen Ritter. */
  NOT_DISPLACING: 'NOT_DISPLACING',

  /** Der Raeuber steht schon auf diesem Feld. */
  ROBBER_SAME_HEX: 'ROBBER_SAME_HEX',
  /** Der Raeuber steht an keinem der drei Felder dieser Kreuzung. */
  ROBBER_NOT_ADJACENT: 'ROBBER_NOT_ADJACENT',
  /** Der Raeuber bleibt bis zum ersten Barbarenueberfall stehen. */
  ROBBER_LOCKED: 'ROBBER_LOCKED',
  /** Das Opfer hat am Raeuberfeld nichts gebaut oder keine Karten. */
  INVALID_VICTIM: 'INVALID_VICTIM',
  /** Es gaebe ein Opfer, aber es wurde keines benannt. */
  VICTIM_REQUIRED: 'VICTIM_REQUIRED',
  /** Es wurde die falsche Anzahl Karten abgeworfen. */
  WRONG_DISCARD_COUNT: 'WRONG_DISCARD_COUNT',
  /** Dieser Spieler muss gerade nicht abwerfen. */
  NOT_DISCARDING: 'NOT_DISCARDING',

  /** Fuer diesen Tausch gibt es kein Verhaeltnis - oder es ist derselbe Rohstoff. */
  INVALID_TRADE: 'INVALID_TRADE',
  /** Die Bank hat die gewuenschte Ressource nicht mehr. */
  BANK_EMPTY: 'BANK_EMPTY',

  /** Nur der Anbieter darf zuschlagen oder zurueckziehen. */
  NOT_THE_OFFERER: 'NOT_THE_OFFERER',
  /** Dieser Spieler hat auf das Angebot schon geantwortet. */
  ALREADY_RESPONDED: 'ALREADY_RESPONDED',
  /** Der genannte Partner hat weder zugesagt noch gekontert. */
  PARTNER_DID_NOT_ACCEPT: 'PARTNER_DID_NOT_ACCEPT',
  /** Die Frist laeuft noch - es gibt nichts abzulaeuten. */
  DEADLINE_NOT_REACHED: 'DEADLINE_NOT_REACHED',
} as const;

export type RuleViolationCode = (typeof RuleViolationCode)[keyof typeof RuleViolationCode];

export interface RuleViolation {
  readonly code: RuleViolationCode;
  readonly message: string;
}

export function violation(code: RuleViolationCode, message: string): RuleViolation {
  return { code, message };
}
