import { z } from 'zod';

import type { TrackId } from '../tracks.js';

/**
 * Die 25 Fortschrittskarten aus "Staedte & Ritter" - drei Stapel zu je 18
 * Karten, eine Karte je Art (`docs/regeln-staedte-und-ritter.md` 11.1-11.3).
 *
 * Diese Tabelle ist das Fundament: jede spaetere Aufgabe der Etappe fragt sie
 * ab, statt eine eigene Vorstellung vom Stapel einer Karte mitzubringen.
 *
 * **`roadBuilding` kollidiert absichtlich mit der Entwicklungskarte** aus
 * `development.ts` (`DevelopmentCardId`). Beide Unionen sind getrennt, und an
 * einem Tisch laeuft nie beides gleichzeitig - die Spec haelt in 1.3 fest,
 * dass `developmentDeck` gesetzt gegen `progressDecks` gesetzt entscheidet,
 * welches System gilt. Nicht aufraeumen.
 */
export const PROGRESS_CARD_IDS = [
  // Wissenschaft (gruen)
  'alchemist',
  'crane',
  'mining',
  'irrigation',
  'printer',
  'inventor',
  'engineer',
  'medicine',
  'smith',
  'roadBuilding',
  // Handel (gelb)
  'merchant',
  'resourceMonopoly',
  'commodityMonopoly',
  'tradeHarbor',
  'merchantFleet',
  'masterMerchant',
  // Politik (blau)
  'spy',
  'bishop',
  'deserter',
  'diplomat',
  'warlord',
  'wedding',
  'intrigue',
  'saboteur',
  'constitution',
] as const;

export const ProgressCardIdSchema = z.enum(PROGRESS_CARD_IDS);
export type ProgressCardId = z.infer<typeof ProgressCardIdSchema>;

/** Zu welchem Stapel eine Karte gehoert. */
export const PROGRESS_TRACK: Readonly<Record<ProgressCardId, TrackId>> = {
  // Wissenschaft
  alchemist: 'science',
  crane: 'science',
  mining: 'science',
  irrigation: 'science',
  printer: 'science',
  inventor: 'science',
  engineer: 'science',
  medicine: 'science',
  smith: 'science',
  roadBuilding: 'science',
  // Handel
  merchant: 'trade',
  resourceMonopoly: 'trade',
  commodityMonopoly: 'trade',
  tradeHarbor: 'trade',
  merchantFleet: 'trade',
  masterMerchant: 'trade',
  // Politik
  spy: 'politics',
  bishop: 'politics',
  deserter: 'politics',
  diplomat: 'politics',
  warlord: 'politics',
  wedding: 'politics',
  intrigue: 'politics',
  saboteur: 'politics',
  constitution: 'politics',
};

/** Der deutsche Name auf der Karte - sichtbarer Text, also mit Umlauten. */
export const PROGRESS_NAMES: Readonly<Record<ProgressCardId, string>> = {
  alchemist: 'Alchemie',
  crane: 'Kran',
  mining: 'Bergbau',
  irrigation: 'Bewässerung',
  printer: 'Buchdruck',
  inventor: 'Erfinder',
  engineer: 'Ingenieur',
  medicine: 'Medizin',
  smith: 'Schmied',
  roadBuilding: 'Straßenbau',
  merchant: 'Händler',
  resourceMonopoly: 'Rohstoffmonopol',
  commodityMonopoly: 'Handelsmonopol',
  tradeHarbor: 'Handelshafen',
  merchantFleet: 'Handelsflotte',
  masterMerchant: 'Großhändler',
  spy: 'Spionage',
  bishop: 'Bischof',
  deserter: 'Deserteur',
  diplomat: 'Diplomat',
  warlord: 'Heerführer',
  wedding: 'Hochzeit',
  intrigue: 'Intrige',
  saboteur: 'Sabotage',
  constitution: 'Verfassung',
};

/** Die Wirkung als Satz, fuer die Karte am Bildschirm. */
export const PROGRESS_TEXTS: Readonly<Record<ProgressCardId, string>> = {
  alchemist:
    'Vor dem Wurf spielen und beide Augenwürfel bestimmen; der Ereigniswürfel wird normal geworfen.',
  crane: 'Ein Stadtausbau kostet in diesem Zug eine Handelsware weniger.',
  mining: 'Zwei Erz je Gebirgsfeld mit eigener Siedlung oder Stadt.',
  irrigation: 'Zwei Getreide je Ackerland mit eigener Siedlung oder Stadt.',
  printer: 'Ein Siegpunkt, sofort offen.',
  inventor: 'Zwei Zahlenchips vertauschen, außer 2, 12, 6 und 8.',
  engineer: 'Eine Stadtmauer gratis.',
  medicine: 'Eine Siedlung wird zur Stadt für zwei Erz und ein Getreide.',
  smith: 'Zwei Ritter je eine Stufe gratis aufwerten.',
  roadBuilding: 'Zwei Straßen gratis.',
  merchant:
    'Händlerfigur neben eine eigene Siedlung oder Stadt setzen und dort 2:1 tauschen; bringt einen Siegpunkt, solange man sie hat.',
  resourceMonopoly: 'Eine Rohstoffsorte bestimmen; alle anderen geben zwei Karten davon ab.',
  commodityMonopoly: 'Eine Handelsware bestimmen; alle anderen geben eine Karte davon ab.',
  tradeHarbor:
    'Jeder anderen Person einmal einen Rohstoff anbieten gegen eine Handelsware ihrer Wahl.',
  merchantFleet: 'Bis Zugende eine Sorte beliebig oft 2:1 tauschen.',
  masterMerchant:
    'Eine Person mit mehr Siegpunkten wählen, ihre Handkarten ansehen und zwei davon nehmen.',
  spy: 'Fortschrittskarten einer Person ansehen und eine davon nehmen, keine Siegpunktkarten.',
  bishop: 'Räuber versetzen und von jeder Person am neuen Feld eine Handkarte ziehen.',
  deserter:
    'Eine Person entfernt einen Ritter ihrer Wahl; man stellt selbst einen gleichwertigen Ritter auf.',
  diplomat: 'Eine offene Straße entfernen; eine eigene darf sofort neu gesetzt werden.',
  warlord: 'Alle eigenen Ritter gratis aktivieren.',
  wedding: 'Jede Person mit mehr Siegpunkten schenkt zwei Karten ihrer Wahl.',
  intrigue: 'Einen fremden Ritter ohne eigenen Ritter von einer erreichbaren Kreuzung vertreiben.',
  saboteur:
    'Alle mit gleich vielen oder mehr Siegpunkten verlieren die Hälfte ihrer Handkarten, abgerundet.',
  constitution: 'Ein Siegpunkt, sofort offen.',
};

/**
 * Wie viele Karten je Art im vollstaendigen Spiel liegen - 54 zusammen.
 *
 * Die Zahlen stammen aus `docs/regeln-staedte-und-ritter.md` 11.1-11.3 und
 * ergeben je Stapel 18 - das prueft der Test in `cards.test.ts` und ist der
 * einzige Schutz gegen einen Tippfehler in einer Tabelle mit 25 Zeilen.
 */
export const FULL_PROGRESS_DECK: Readonly<Record<ProgressCardId, number>> = {
  // Wissenschaft: 2+2+2+2+1+2+1+2+2+2 = 18
  alchemist: 2,
  crane: 2,
  mining: 2,
  irrigation: 2,
  printer: 1,
  inventor: 2,
  engineer: 1,
  medicine: 2,
  smith: 2,
  roadBuilding: 2,
  // Handel: 6+4+2+2+2+2 = 18
  merchant: 6,
  resourceMonopoly: 4,
  commodityMonopoly: 2,
  tradeHarbor: 2,
  merchantFleet: 2,
  masterMerchant: 2,
  // Politik: 3+2+2+2+2+2+2+2+1 = 18
  spy: 3,
  bishop: 2,
  deserter: 2,
  diplomat: 2,
  warlord: 2,
  wedding: 2,
  intrigue: 2,
  saboteur: 2,
  constitution: 1,
};

/** Hoechstens so viele Fortschrittskarten auf der Hand. Siegpunktkarten zaehlen nicht. */
export const PROGRESS_HAND_LIMIT = 4;

/** Die beiden Karten, die sofort offen liegen und einen Punkt bringen. */
export const PROGRESS_VICTORY_CARDS: readonly ProgressCardId[] = ['printer', 'constitution'];
