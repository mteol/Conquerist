import type { Cue } from './cues';

/**
 * Wo eine mp3 die Synthese ersetzt.
 *
 * **Die Synthese ist die Voreinstellung und bleibt es.** Ein Eintrag hier ist
 * eine bewusste Ausnahme fuer genau einen Klang. Faellt die Datei aus - nicht
 * da, nicht dekodierbar, zu langsam - klingt weiter die Synthese; ein fehlendes
 * Sample darf nie ein stummes Spiel bedeuten.
 *
 * Einbauen: Datei nach `apps/client/public/sounds/` legen (Vite kopiert den
 * Ordner unveraendert nach `dist`) und die Zeile entkommentieren. Kein
 * Codeeingriff, keine Bedingung, kein Umbau der Engine.
 *
 * Die Liste ist zugleich die Einkaufsliste - je Zeile steht, was gesucht wird.
 */
export const SAMPLES: Partial<Record<Cue, string>> = {
  // 'ui.click':         '/sounds/click.mp3',      // trockener Knopf, ~50 ms
  // 'ui.confirm':       '/sounds/confirm.mp3',    // kurze Bestaetigung, ~120 ms
  // 'ui.cancel':        '/sounds/cancel.mp3',     // Ruecknahme, ~120 ms
  // 'ui.error':         '/sounds/error.mp3',      // abgelehnt, leise, ~300 ms
  // 'build.road':       '/sounds/road.mp3',       // Holz auf Holz, ~150 ms
  // 'build.settlement': '/sounds/settlement.mp3', // Aufsetzen, ~200 ms
  // 'build.city':       '/sounds/city.mp3',       // schwerer Aufsatz, ~250 ms
  // 'dice.roll':        '/sounds/dice-roll.mp3',  // Wuerfel poltern, ~500 ms
  // 'dice.land':        '/sounds/dice-land.mp3',  // Ping beim Liegenbleiben
  // 'dice.seven':       '/sounds/seven.mp3',      // dunkel, unheilvoll, ~500 ms
  // 'gain.self':        '/sounds/gain.mp3',       // Karten kommen, ~250 ms
  // 'robber.move':      '/sounds/robber.mp3',     // dumpfes Aufsetzen, ~350 ms
  // 'robber.steal':     '/sounds/steal.mp3',      // Karte rutscht weg, ~200 ms
  // 'discard.required': '/sounds/discard.mp3',    // Aufforderung, ~300 ms
  // 'card.buy':         '/sounds/card-buy.mp3',   // Karte ziehen, ~200 ms
  // 'card.knight':      '/sounds/knight.mp3',     // fester Schlag, ~200 ms
  // 'card.play':        '/sounds/card-play.mp3',  // Karte legen, ~200 ms
  // 'trade.offer':      '/sounds/offer.mp3',      // ruft, zweitoenig, ~350 ms
  // 'trade.accept':     '/sounds/accept.mp3',     // Handschlag, ~300 ms
  // 'trade.reject':     '/sounds/reject.mp3',     // Absage, ~300 ms
  // 'trade.timeout':    '/sounds/timeout.mp3',    // Frist verfaellt, ~400 ms
  // 'turn.mine':        '/sounds/your-turn.mp3',  // ruhiger Anruf, ~400 ms
  // 'game.over':        '/sounds/game-over.mp3',  // Schlussfigur, ~800 ms
};
