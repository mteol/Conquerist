/**
 * Das Windstrahlennetz einer Seekarte - reine Geometrie.
 *
 * Portolankarten tragen kein Gradnetz, sondern ein Netz aus Kurslinien:
 * sechzehn Punkte gleichmaessig auf einem verborgenen Kreis, jeder mit jedem
 * verbunden. Weil die Punkte auf Vielfachen von 22,5 Grad liegen, laeuft jede
 * Sehne in einer der 32 Richtungen der Windrose - das Netz ist eine Rose, die
 * sechzehnmal wiederholt ist.
 *
 * Die Karten unterscheiden die Linien nach ihrem Wind, und zwar ueber die
 * Farbe: die acht Hauptwinde dunkel, die acht Halbwinde gruen, die sechzehn
 * Viertelwinde rot. Dieselbe Dreiteilung steht hier als `rank`.
 */

export const RHUMB_NODES = 16;

/** Hauptwind (N, NO, O ...), Halbwind (NNO ...), Viertelwind. */
export type WindRank = 'wind' | 'half' | 'quarter';

export interface ChartPoint {
  readonly x: number;
  readonly y: number;
}

export interface RhumbLine {
  readonly from: ChartPoint;
  readonly to: ChartPoint;
  readonly rank: WindRank;
  /**
   * Richtung der Linie in Schritten von 11,25 Grad, 0..15 (0 = Nord-Sued,
   * 8 = Ost-West). Eine Linie hat keinen Richtungssinn: die 32 Winde der Rose
   * sind sechzehn Linien, jede in beide Richtungen gelesen.
   */
  readonly wind: number;
}

/** Der Knoten `index` auf dem Kreis; Knoten 0 liegt im Norden, weiter im Uhrzeigersinn. */
export function rhumbNode(index: number, radius: number): ChartPoint {
  const angle = (index / RHUMB_NODES) * Math.PI * 2;
  return { x: Math.sin(angle) * radius, y: -Math.cos(angle) * radius };
}

/**
 * Der Wind einer Sehne zwischen zwei Knoten.
 *
 * Eine Sehne steht senkrecht auf dem Radius durch ihre Mitte, und der liegt
 * beim Mittel der beiden Knotenwinkel. In Schritten von 11,25 Grad gezaehlt
 * ist das `i + j`; die Vierteldrehung dazu sind acht Schritte.
 */
export function windOf(i: number, j: number): number {
  return (i + j + 8) % 16;
}

export function rankOf(wind: number): WindRank {
  if (wind % 4 === 0) return 'wind';
  if (wind % 2 === 0) return 'half';
  return 'quarter';
}

/** Alle 120 Sehnen des Netzes. */
export function rhumbLines(radius: number): RhumbLine[] {
  const lines: RhumbLine[] = [];
  for (let i = 0; i < RHUMB_NODES; i++) {
    for (let j = i + 1; j < RHUMB_NODES; j++) {
      const wind = windOf(i, j);
      lines.push({
        from: rhumbNode(i, radius),
        to: rhumbNode(j, radius),
        rank: rankOf(wind),
        wind,
      });
    }
  }
  return lines;
}
