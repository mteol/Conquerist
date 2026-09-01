/**
 * Staedte & Ritter - die Erweiterung an einem Ort.
 *
 * Ein eigener Ordner und ein eigener Sammelpunkt, weil es hier auf ein gutes
 * Dutzend Dateien hinauslaeuft. Flach in `game/` waere die Haelfte davon
 * Erweiterung, und die Frage "was gehoert zu Staedte & Ritter" haette keine
 * Antwort mehr im Dateisystem.
 */
export * from './barbarians.js';
export * from './event.js';
export * from './improvements.js';
export * from './knightActions.js';
export * from './knightMoves.js';
export * from './knights.js';
/*
 * Nur die Kartentabellen aus `progress/`, nicht der ganze Ordner.
 *
 * `progress/cards.js` ist reine Auskunft - Namen, Zugehoerigkeit zum Stapel,
 * Stueckzahl - und genau das braucht die Oberflaeche (Aufgabe 15: die drei
 * Stapel, die Hand, die Dialoge). Die uebrigen Dateien dort (`play.js`,
 * `progressRules.js`, `science.js`, `commerce.js`, `politics.js`, `draw.js`)
 * pruefen und wenden Zuege auf dem vollen `GameState` an - das bleibt Sache
 * des Reducers, den der Client ueber `GameAction` erreicht, nicht ueber einen
 * eigenen Aufruf. Vorher fehlte hier jede Zeile zu `progress/`, und
 * `PROGRESS_NAMES` & Co. waren trotz der Ankuendigung in Aufgabe 15 von
 * ausserhalb des Pakets nicht erreichbar.
 */
export * from './progress/cards.js';
/*
 * Nur `canPlaceMerchant`, benannt und nicht mit Stern, aus `merchant.js`.
 *
 * Ein Stern brächte `applyMerchant` mit heraus - und `applyMerchant` heisst
 * ein zweites Mal so in `progress/commerce.js`. Heute kollidiert das nicht,
 * weil `progress/` hier oben nur ueber `cards.js` hereinkommt; kaeme
 * `commerce.js` je dazu, waeren zwei `applyMerchant` im selben Sammelpunkt,
 * und ein mehrdeutiger Stern-Export verschwindet in ESM stillschweigend statt
 * einen Fehler zu werfen - ein Import, der heute geht, ginge dann
 * kommentarlos ins Leere. `applyMerchant` selbst gehoert ohnehin nicht hier
 * heraus: es wendet einen Zug an, und das bleibt nach der Regel oben Sache
 * des Reducers. `canPlaceMerchant` ist dagegen eine reine Regelfrage, kein
 * Zug, und passt zu dieser Regel wie `canPlaceRobberAt` aus `robber.js`
 * (siehe `game/index.ts`).
 */
export { canPlaceMerchant } from './merchant.js';
export * from './rollFlow.js';
export * from './tracks.js';
export * from './turn.js';
export * from './walls.js';
