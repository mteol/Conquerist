// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { MAX_VICTORY_POINT_GOAL, SEAT_COLORS } from '@conquerist/shared';
import { render, screen, userEvent } from '../test/dom';
import { LobbyScreen, goalFor } from './LobbyScreen';

const room = {
  code: 'K7X2',
  hostId: 'u1',
  seatCount: 3,
  seed: 'abc',
  victoryPointGoal: 10,
  variant: 'classic' as const,
  started: false,
  seats: [
    { userId: 'u1', name: 'Anna', color: '#c0392b', connected: true },
    { userId: 'u2', name: 'Ben', color: '#2c6fbb', connected: true },
  ],
};

/** Die Pflichtangaben; jeder Test ergaenzt nur, was er wirklich braucht. */
function lobby(props: Partial<Parameters<typeof LobbyScreen>[0]> = {}) {
  return (
    <LobbyScreen
      room={room}
      youId="u1"
      onStart={vi.fn()}
      onLeave={vi.fn()}
      onConfigure={vi.fn()}
      onChooseColor={vi.fn()}
      onRename={vi.fn()}
      {...props}
    />
  );
}

describe('Wartebereich', () => {
  it('zeigt Code und beigetretene Sitze', () => {
    render(lobby({ youId: 'u2' }));

    expect(screen.getByText('K7X2')).toBeDefined();
    expect(screen.getByText('Anna')).toBeDefined();
    expect(screen.getByText('Ben')).toBeDefined();
  });

  /**
   * Was erklaert wurde, steht nicht mehr da.
   *
   * Drei Saetze sind gefallen: „Gleicher Seed, gleiches Brett - bei euch und
   * bei allen anderen", „Zehn wie in der Schachtel" und „Zwischen 5 und 20 -
   * zehn sind die Vorgabe". Sie erklaerten, was daneben ohnehin steht oder was
   * die gesperrten Knoepfe schon sagen, und sie waren zusammen rund achtzig
   * Pixel Hoehe auf einem Bildschirm, der ohne Scrollen passen soll.
   *
   * Der Test haelt das fest, weil ein weggelassener Satz nichts kaputtmacht -
   * er kommt beim naechsten Umbau einfach wieder, und niemand merkt es.
   * Geprueft wird beides: dass die Erklaerungen weg sind **und** dass die eine
   * Auskunft dasteht, die man nicht sehen kann.
   */
  it('erklaert Seed und Siegpunktziel nicht mehr in Saetzen', () => {
    const { container } = render(lobby());
    const text = container.textContent ?? '';

    expect(text).not.toMatch(/gleiches Brett/i);
    expect(text).not.toMatch(/Schachtel/i);
    expect(text).not.toMatch(/Vorgabe/i);
    expect(screen.getByText('10 sind das Original')).toBeDefined();
  });

  it('gibt den Startknopf nur dem Host', () => {
    render(lobby({ youId: 'u2' }));
    expect(screen.queryByRole('button', { name: /starten/i })).toBeNull();
    expect(screen.getByText(/Wartet auf Anna/)).toBeDefined();
  });

  /**
   * Die Zahl der Fehlenden steht im Tisch und nicht in einem Satz darunter.
   *
   * Hier wurde einmal „Es fehlt noch 1 Mitspieler" geprueft. Der Satz ist weg:
   * er sagte zum dritten Mal, was der gestrichelte Platz und der gesperrte
   * Knopf schon sagen - und der Platz sagt es besser, weil man ihn sieht, ohne
   * zu lesen. Geprueft wird deshalb jetzt die Sperre und der offene Platz; das
   * ist dieselbe Auskunft an ihren zwei verbliebenen Orten.
   */
  it('sperrt den Start, solange Plaetze fehlen, und zeigt sie als offene Sitze', () => {
    render(lobby());

    const start = screen.getByRole('button', { name: /starten/i });
    expect(start).toHaveProperty('disabled', true);
    expect(screen.getAllByTestId('seat-open')).toHaveLength(1);
    expect(screen.queryByText(/Mitspieler/i)).toBeNull();
  });

  it('gibt den Start frei, wenn der Tisch voll ist', () => {
    const full = {
      ...room,
      seats: [...room.seats, { userId: 'u3', name: 'Cem', color: '#e08a2e', connected: true }],
    };

    render(lobby({ room: full }));
    expect(screen.getByRole('button', { name: /starten/i })).toHaveProperty('disabled', false);
  });

  it('zeichnet jeden fehlenden Platz als leeren Stein in seiner kuenftigen Farbe', () => {
    render(lobby());

    // Der leere Platz ist die Anzeige der Zahl - wer zaehlen will, zaehlt
    // Steine und liest keine Ziffer.
    expect(screen.getAllByTestId('seat-open')).toHaveLength(1);
    expect(screen.getAllByTestId('seat-taken')).toHaveLength(2);
  });

  it('legt dem Host einen Platz dazu - am Tisch selbst', async () => {
    const onConfigure = vi.fn();
    render(lobby({ onConfigure }));

    await userEvent.click(screen.getByRole('button', { name: 'Platz hinzufügen' }));

    expect(onConfigure).toHaveBeenCalledWith(4, 'abc', 10, 'classic');
  });

  it('nimmt einen Platz weg, solange einer frei ist', async () => {
    const onConfigure = vi.fn();
    render(lobby({ room: { ...room, seatCount: 4 }, onConfigure }));

    await userEvent.click(screen.getByRole('button', { name: 'Platz entfernen' }));

    expect(onConfigure).toHaveBeenCalledWith(3, 'abc', 10, 'classic');
  });

  it('geht nie unter die kleinste Tischgroesse', () => {
    // Drei Plaetze sind das Minimum - da ist nichts mehr wegzunehmen.
    render(lobby());

    expect(screen.getByRole('button', { name: 'Platz entfernen' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('geht nie unter die Zahl derer, die schon sitzen', () => {
    const crowded = {
      ...room,
      seatCount: 4,
      seats: [
        ...room.seats,
        { userId: 'u3', name: 'Cem', color: '#e08a2e', connected: true },
        { userId: 'u4', name: 'Dana', color: '#3f8f5b', connected: true },
      ],
    };

    render(lobby({ room: crowded }));

    // Sonst muesste einer der vier seinen Platz raeumen.
    expect(screen.getByRole('button', { name: 'Platz entfernen' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('laesst den Host einen neuen Seed wuerfeln', async () => {
    const onConfigure = vi.fn();
    render(lobby({ onConfigure }));

    await userEvent.click(screen.getByRole('button', { name: 'Neu würfeln' }));

    const [seatCount, seed] = onConfigure.mock.calls[0]!;
    expect(seatCount).toBe(3);
    expect(seed).not.toBe('abc');
    expect(String(seed).length).toBeGreaterThan(0);
  });

  it('gibt niemandem ausser dem Host die Einstellungen in die Hand', () => {
    render(lobby({ youId: 'u2' }));

    expect(screen.queryByRole('button', { name: 'Platz hinzufügen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Neu würfeln' })).toBeNull();
    // Sehen soll sie trotzdem jeder - sonst weiss niemand, worauf er wartet.
    expect(screen.getByText('abc')).toBeDefined();
  });

  it('stellt nichts mehr um, sobald die Partie laeuft', () => {
    render(lobby({ room: { ...room, started: true } }));

    expect(screen.queryByRole('button', { name: 'Platz hinzufügen' })).toBeNull();
  });
});

/**
 * Was jedem selbst gehoert: Farbe und Name.
 *
 * Beides steht ohne `canConfigure` da - der Gastgeber stellt den Tisch ein,
 * seinen eigenen Platz stellt jeder selbst ein.
 */
describe('Der eigene Platz', () => {
  it('laesst eine freie Farbe waehlen', async () => {
    const onChooseColor = vi.fn();
    render(lobby({ onChooseColor }));

    await userEvent.click(screen.getByTestId(`color-${SEAT_COLORS[4]}`));

    expect(onChooseColor).toHaveBeenCalledWith(SEAT_COLORS[4]);
  });

  it('sperrt Farben, die schon jemand hat, und sagt bei wem', () => {
    render(lobby({ youId: 'u1' }));

    // Bens Blau ist vergeben, Annas Rot ist ihr eigenes.
    const bens = screen.getByTestId('color-#2c6fbb');
    expect(bens).toHaveProperty('disabled', true);
    expect(bens.getAttribute('title')).toContain('Ben');
    expect(screen.getByTestId('color-#c0392b')).toHaveProperty('disabled', false);
  });

  it('nennt jede Farbe beim Namen - ein Fleck allein traegt nichts', () => {
    render(lobby());
    expect(screen.getByText('Violett')).toBeDefined();
  });

  it('schickt den neuen Namen erst, wenn das Feld verlassen wird', async () => {
    const onRename = vi.fn();
    render(lobby({ onRename }));

    const field = screen.getByLabelText('Dein Name');
    await userEvent.clear(field);
    await userEvent.type(field, 'Annabel');
    expect(onRename).not.toHaveBeenCalled();

    await userEvent.tab();

    expect(onRename).toHaveBeenCalledWith('Annabel');
  });

  it('schickt nichts, wenn der Name leer bleibt', async () => {
    const onRename = vi.fn();
    render(lobby({ onRename }));

    const field = screen.getByLabelText('Dein Name');
    await userEvent.clear(field);
    await userEvent.tab();

    expect(onRename).not.toHaveBeenCalled();
    // Und im Feld steht wieder der Name, unter dem man am Tisch sitzt.
    expect(field).toHaveProperty('value', 'Anna');
  });
});

describe('Siegpunktziel', () => {
  it('zeigt das Ziel jedem, auch ohne Einstellrecht', () => {
    render(lobby({ youId: 'u2' }));

    expect(screen.getByTestId('goal').textContent).toBe('10');
    expect(screen.queryByRole('button', { name: 'Ein Siegpunkt mehr' })).toBeNull();
  });

  it('stellt es dem Host um', async () => {
    const onConfigure = vi.fn();
    render(lobby({ onConfigure }));

    await userEvent.click(screen.getByRole('button', { name: 'Ein Siegpunkt mehr' }));

    expect(onConfigure).toHaveBeenCalledWith(3, 'abc', 11, 'classic');
  });

  it('geht nicht ueber seine Grenzen hinaus', () => {
    render(lobby({ room: { ...room, victoryPointGoal: MAX_VICTORY_POINT_GOAL } }));

    expect(screen.getByRole('button', { name: 'Ein Siegpunkt mehr' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByRole('button', { name: 'Ein Siegpunkt weniger' })).toHaveProperty(
      'disabled',
      false,
    );
  });
});

describe('Regelwerk', () => {
  it('nennt das eingestellte Regelwerk', () => {
    render(lobby({ room: { ...room, variant: 'cities' as const } }));

    expect(screen.getByTestId('variant').textContent).toBe('Städte & Ritter');
  });

  it('stellt es dem Host um', async () => {
    const onConfigure = vi.fn();
    render(lobby({ onConfigure }));

    await userEvent.click(screen.getByRole('button', { name: 'Städte & Ritter' }));

    expect(onConfigure).toHaveBeenCalledWith(3, 'abc', 13, 'cities');
  });

  /*
   * Der gesperrte Knopf ist der, auf dem man steht. `disabled` allein aendert
   * an einem Knopf mit eigenem Hintergrund die Farben nicht - die Wahl saehe
   * dann aus wie keine (CLAUDE.md).
   */
  it('zeigt die getroffene Wahl als getroffen', () => {
    render(lobby());

    const gewaehlt = screen.getByRole('button', { name: 'Basisspiel' });
    expect(gewaehlt.className).toContain('is-chosen');
    expect(gewaehlt.getAttribute('aria-pressed')).toBe('true');
  });

  it('laesst Mitspieler nur lesen', () => {
    render(lobby({ youId: 'u2' }));

    expect(screen.getByTestId('variant')).toBeDefined();
    expect(screen.queryByRole('group', { name: 'Regelwerk wählen' })).toBeNull();
  });
});

/**
 * Das Siegpunktziel beim Wechsel des Regelwerks.
 *
 * Die Vorgabe springt mit - aber nur, solange sie noch die Vorgabe war. Wer
 * eine eigene Zahl eingestellt hat, behaelt sie: eine Umstellung, die eine
 * getroffene Entscheidung ueberschreibt, ist ein Eingriff in eine fremde
 * Entscheidung (dieselbe Lehre wie bei der Sitzfarbe).
 */
describe('goalFor', () => {
  it('springt von der einen Vorgabe auf die andere', () => {
    expect(goalFor('cities', 10)).toBe(13);
    expect(goalFor('classic', 13)).toBe(10);
  });

  it('laesst eine eingestellte Zahl stehen', () => {
    expect(goalFor('cities', 12)).toBe(12);
    expect(goalFor('classic', 8)).toBe(8);
    expect(goalFor('cities', 13)).toBe(13);
  });
});
