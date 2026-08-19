/**
 * Die Hintergrundspur - eine Datei, in Schleife, ueber alle Bildschirme.
 *
 * **Sie ist die eine Ausnahme von „kein Audio-Byte im Image".** Die 23 Effekte
 * sind Rezepte aus Zahlen und bleiben es: ein Klick, ein Wuerfel, ein
 * Handschlag lassen sich aus Huellkurven bauen, und ein Rezept wiegt nichts.
 * Ein Stueck Musik laesst sich das nicht - synthetisiert waere es eine
 * Tonfolge, kein Stueck. Dafuer liegt hier eine Datei und kostet, was sie
 * kostet; `samples.ts` daneben bleibt leer.
 *
 * Faellt sie aus - nicht da, nicht dekodierbar, vom Browser nicht freigegeben -
 * bleibt es still und das Spiel laeuft weiter. Dieselbe Zusage wie bei den
 * Samples: eine fehlende Datei darf nie ein kaputtes Spiel bedeuten.
 *
 * Der Pfad zeigt in `apps/client/public/`, den Vite unveraendert nach `dist`
 * kopiert - dieselbe Ablage, die `samples.ts` fuer mp3s nennt.
 */
export const MUSIC_TRACK = '/music/catan.mp3';
