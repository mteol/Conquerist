import { describe, expect, it } from 'vitest';
import { hexFromId } from '@conquerist/shared';

import { EMPTY_TARGETS, type ActionTargets } from '../game/targets';
import { hexCenter, vertexPoint } from './layout';
import { nearestTarget, PICK_REACH, targetPoints, type TargetPoint } from './pick';

const CENTER = 'v:0,0|1,-1|1,0';
const NEIGHBOUR = 'v:0,0|0,1|1,0';

const at = (vertex: string): TargetPoint => ({
  place: { kind: 'vertex', id: vertex },
  point: vertexPoint(vertex),
});

describe('nearestTarget', () => {
  it('nimmt das naehere von zwei Zielen', () => {
    const nahe = vertexPoint(CENTER);

    expect(nearestTarget({ x: nahe.x + 0.1, y: nahe.y }, [at(CENTER), at(NEIGHBOUR)])).toEqual({
      kind: 'vertex',
      id: CENTER,
    });
  });

  it('nimmt auch dann das naehere, wenn das andere zuerst in der Liste steht', () => {
    // Der ganze Grund fuer diese Funktion: bei ueberlappenden Trefferflaechen
    // entschied vorher die Zeichenreihenfolge. Sie darf hier nichts entscheiden.
    const nahe = vertexPoint(CENTER);

    expect(nearestTarget({ x: nahe.x + 0.1, y: nahe.y }, [at(NEIGHBOUR), at(CENTER)])).toEqual({
      kind: 'vertex',
      id: CENTER,
    });
  });

  it('gibt null zurueck, wenn nichts in Reichweite liegt', () => {
    expect(nearestTarget({ x: 99, y: 99 }, [at(CENTER)])).toBeNull();
  });

  it('gibt null zurueck, wenn es gar keine Ziele gibt', () => {
    // Der Fall des Vorschau-Bretts auf dem Startbildschirm.
    expect(nearestTarget({ x: 0, y: 0 }, [])).toBeNull();
  });

  it('haelt die Reichweite ein', () => {
    const nahe = vertexPoint(CENTER);

    expect(
      nearestTarget({ x: nahe.x + PICK_REACH - 0.01, y: nahe.y }, [at(CENTER)]),
    ).not.toBeNull();
    expect(nearestTarget({ x: nahe.x + PICK_REACH + 0.01, y: nahe.y }, [at(CENTER)])).toBeNull();
  });

  it('bleibt bei gleichem Abstand bestimmt', () => {
    const a = vertexPoint(CENTER);
    const b = vertexPoint(NEIGHBOUR);
    const mitte = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

    expect(nearestTarget(mitte, [at(CENTER), at(NEIGHBOUR)])).toEqual(
      nearestTarget(mitte, [at(CENTER), at(NEIGHBOUR)]),
    );
  });

  it('trifft einen Nachbarknoten nicht, wenn der Tipp naeher am eigenen liegt', () => {
    // Die Zahl, um die es geht: benachbarte Knoten liegen 1 Einheit
    // auseinander. Ein Tipp bei 0,4 gehoert eindeutig zum naeheren.
    const a = vertexPoint(CENTER);
    const b = vertexPoint(NEIGHBOUR);
    const richtung = { x: b.x - a.x, y: b.y - a.y };

    expect(
      nearestTarget({ x: a.x + richtung.x * 0.4, y: a.y + richtung.y * 0.4 }, [
        at(CENTER),
        at(NEIGHBOUR),
      ]),
    ).toEqual({ kind: 'vertex', id: CENTER });
  });
});

describe('targetPoints', () => {
  const withAll = (): ActionTargets => ({
    ...EMPTY_TARGETS,
    vertices: new Map([[CENTER, { type: 'buildSettlement', player: 'p1', vertex: CENTER }]]),
    edges: new Map([['e:0,0|1,0', { type: 'buildRoad', player: 'p1', edge: 'e:0,0|1,0' }]]),
    hexes: new Map([['1,0', [{ type: 'moveRobber', player: 'p1', hex: '1,0', victim: null }]]]),
  });

  it('nimmt Knoten, Kanten und Felder auf', () => {
    const punkte = targetPoints(withAll());

    expect(punkte.map((eintrag) => eintrag.place.kind).sort()).toEqual(['edge', 'hex', 'vertex']);
  });

  it('legt ein Feldziel in die Feldmitte', () => {
    const punkte = targetPoints(withAll());
    const feld = punkte.find((eintrag) => eintrag.place.kind === 'hex');

    expect(feld?.point).toEqual(hexCenter(hexFromId('1,0')));
  });

  it('gibt bei leeren Zielen eine leere Liste', () => {
    expect(targetPoints(EMPTY_TARGETS)).toEqual([]);
  });
});
