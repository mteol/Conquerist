import { z } from 'zod';

import { isEdgeId } from '../geometry/index.js';
import { ResourceIdSchema } from './terrain.js';

/**
 * Haefen als reine Daten: eine Kuestenkante plus ein Tauschverhaeltnis.
 *
 * Die Handelsregeln selbst kommen erst in Etappe 8. Was jetzt schon feststeht,
 * ist die Topologie - ein Hafen liegt an einer Kante, und die beiden Knoten
 * dieser Kante sind die Siedlungsplaetze, die ihn nutzen duerfen. Das ist
 * ableitbar (`edgeVertices`) und wird deshalb nicht gespeichert.
 */

/** 2:1 tauscht eine bestimmte Ressource, 3:1 jede beliebige. */
export const HARBOR_RATIOS = [2, 3] as const;

export const HarborSchema = z
  .object({
    /** Kanonische Id der Kuestenkante, an der der Hafen liegt. */
    edge: z.string().refine(isEdgeId, { message: 'Keine kanonische Kanten-Id' }),
    /** Wie viele Karten fuer eine: 2 oder 3. */
    ratio: z.union([z.literal(2), z.literal(3)]),
    /** Nur beim 2:1-Hafen gesetzt. */
    resource: ResourceIdSchema.optional(),
  })
  .refine((harbor) => harbor.ratio !== 2 || harbor.resource !== undefined, {
    message: 'Ein 2:1-Hafen braucht die Ressource, die er tauscht',
    path: ['resource'],
  })
  .refine((harbor) => harbor.ratio !== 3 || harbor.resource === undefined, {
    message: 'Ein 3:1-Hafen tauscht jede Ressource und nennt deshalb keine',
    path: ['resource'],
  });

export type HarborDefinition = z.infer<typeof HarborSchema>;
