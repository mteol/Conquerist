import { z } from 'zod';

/**
 * Entwicklungskarten.
 *
 * Der Platz dafuer steht seit Etappe 2: `developmentCard` hat einen Preis in
 * `BUILDABLE_IDS`, und `PIECE_IDS` schliesst sie ausdruecklich aus, weil sie
 * der Bank gehoeren und nicht dem Spieler. Hier wird der Haken eingeloest.
 *
 * **Sie sind die zweite geheime Haelfte des Zustands.** Bisher war das nur der
 * `rng` und die Handkarten der Mitspieler; ab jetzt auch, welche Karten wer auf
 * der Hand hat und was noch im Stapel liegt. Wer den Stapel kennt, weiss, ob
 * sich der naechste Kauf lohnt - das ist derselbe Bruch wie ein bekannter
 * Wuerfelzustand.
 *
 * Oeffentlich ist dagegen, wie viele Ritter jemand **ausgespielt** hat: sie
 * liegen offen vor ihm und entscheiden die Groesste Rittermacht.
 */
export const DEVELOPMENT_CARD_IDS = [
  'knight',
  'roadBuilding',
  'yearOfPlenty',
  'monopoly',
  'victoryPoint',
] as const;

export type DevelopmentCardId = (typeof DEVELOPMENT_CARD_IDS)[number];

export const DevelopmentCardIdSchema = z.enum(DEVELOPMENT_CARD_IDS);

/**
 * Eine Karte auf der Hand.
 *
 * `boughtOnTurn` ist keine Zierde: eine Entwicklungskarte darf nicht in der
 * Runde gespielt werden, in der sie gekauft wurde. Ohne diesen Vermerk liesse
 * sich ein Ritter kaufen und sofort ausspielen, und die Sieben verloere ihren
 * Schrecken.
 */
export const DevelopmentCardSchema = z.object({
  id: DevelopmentCardIdSchema,
  boughtOnTurn: z.number().int().min(0),
});

export type DevelopmentCard = z.infer<typeof DevelopmentCardSchema>;

/** Wie viele Karten je Art der Stapel enthaelt - die Zahlen stehen im RuleSet. */
export const DevelopmentDeckSchema = z.partialRecord(
  DevelopmentCardIdSchema,
  z.number().int().min(0),
);

export type DevelopmentDeck = z.infer<typeof DevelopmentDeckSchema>;

/**
 * Der ungemischte Stapel aus den Anzahlen im RuleSet.
 *
 * Gemischt wird beim Anlegen der Partie mit dem Seed-PRNG - hier entsteht nur
 * die Liste, damit diese Funktion rein bleibt und ohne Zufall pruefbar ist.
 */
export function buildDeck(counts: DevelopmentDeck): DevelopmentCardId[] {
  const deck: DevelopmentCardId[] = [];
  for (const id of DEVELOPMENT_CARD_IDS) {
    const count = counts[id] ?? 0;
    for (let index = 0; index < count; index += 1) deck.push(id);
  }
  return deck;
}

/** Karten dieser Art auf einer Hand. */
export function countDevelopmentCards(
  cards: readonly DevelopmentCard[],
  id: DevelopmentCardId,
): number {
  return cards.filter((card) => card.id === id).length;
}

/**
 * Ob diese Karte jetzt gespielt werden darf.
 *
 * Siegpunktkarten werden nie gespielt - sie zaehlen einfach. Alles andere
 * braucht eine Runde Geduld.
 */
export function isPlayable(card: DevelopmentCard, turn: number): boolean {
  return card.id !== 'victoryPoint' && card.boughtOnTurn < turn;
}
