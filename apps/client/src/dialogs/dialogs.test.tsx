// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { RESOURCE_IDS, type CardId } from '@conquerist/shared';
import { cardAmounts, pieceCounts } from '@conquerist/shared';
import { act, fireEvent, render, screen, userEvent } from '../test/dom';
import { RESOURCE_LABELS } from '../game/labels';
import type { PlayerRow } from '../game/view';
import { AccountDialog } from './AccountDialog';
import { DiscardDialog } from './DiscardDialog';
import { TradeDialog } from './TradeDialog';

const player: PlayerRow = {
  id: 'p1',
  name: 'Spieler 1',
  color: '#c0392b',
  victoryPoints: 2,
  cardCount: 8,
  resources: cardAmounts({ brick: 3, lumber: 2, wool: 2, grain: 1, ore: 0 }),
  piecesLeft: pieceCounts({ road: 13, settlement: 3, city: 4 }),
  developmentCards: [],
  developmentCount: 0,
  playedKnights: 0,
  isCurrent: true,
  connected: true,
  mustDiscard: 4,
  improvements: {},
};

describe('DiscardDialog', () => {
  it('bestaetigt erst, wenn genau die geforderte Zahl gewaehlt ist', async () => {
    const onConfirm = vi.fn();
    render(
      <DiscardDialog player={player} cards={RESOURCE_IDS} required={4} onConfirm={onConfirm} />,
    );

    expect(screen.getByRole('button', { name: /Abwerfen/ })).toHaveProperty('disabled', true);

    await userEvent.click(screen.getByLabelText('Lehm mehr'));
    await userEvent.click(screen.getByLabelText('Lehm mehr'));
    await userEvent.click(screen.getByLabelText('Holz mehr'));
    await userEvent.click(screen.getByLabelText('Wolle mehr'));

    expect(screen.getByRole('button', { name: /Abwerfen/ })).toHaveProperty('disabled', false);
    await userEvent.click(screen.getByRole('button', { name: /Abwerfen/ }));

    expect(onConfirm).toHaveBeenCalledWith(
      cardAmounts({ brick: 2, lumber: 1, wool: 1, grain: 0, ore: 0 }),
    );
  });

  it('laesst nicht mehr waehlen, als auf der Hand liegt', async () => {
    render(<DiscardDialog player={player} cards={RESOURCE_IDS} required={4} onConfirm={vi.fn()} />);

    await userEvent.click(screen.getByLabelText('Korn mehr'));
    await userEvent.click(screen.getByLabelText('Korn mehr'));

    // Eine Kornkarte liegt da, also bleibt es bei einer - und der Knopf sagt
    // das jetzt auch, statt lautlos zu klemmen.
    expect(screen.getByTestId('chosen-grain').textContent).toBe('1');
    expect(screen.getByLabelText('Korn mehr')).toHaveProperty('disabled', true);
  });

  /*
   * **Ein Knopf, der nichts bewirken kann, sieht jetzt auch so aus.** Im
   * Browser-Durchlauf stand im Abwurffenster „Lehm — von 0" mit einem
   * bedienbaren `+` daneben; gedrueckt hat es nie etwas getan. Dieselbe Sorte
   * Luege wie ein dauerhaft gesperrter Siegpunkt-Knopf, nur andersherum.
   */
  it('sperrt die Schritte, die nichts bewirken koennen', () => {
    render(<DiscardDialog player={player} cards={RESOURCE_IDS} required={4} onConfirm={vi.fn()} />);

    // Erz liegt gar nicht auf der Hand.
    expect(screen.getByLabelText('Erz mehr')).toHaveProperty('disabled', true);
    // Und weniger als nichts geht nirgends.
    expect(screen.getByLabelText('Lehm weniger')).toHaveProperty('disabled', true);
    // Nach oben offen ist nur, was noch da ist.
    expect(screen.getByLabelText('Lehm mehr')).toHaveProperty('disabled', false);
  });

  it('macht alle Schritte tot, sobald die geforderte Zahl beisammen ist', async () => {
    render(<DiscardDialog player={player} cards={RESOURCE_IDS} required={4} onConfirm={vi.fn()} />);

    for (const label of ['Lehm mehr', 'Lehm mehr', 'Lehm mehr', 'Holz mehr']) {
      await userEvent.click(screen.getByLabelText(label));
    }

    expect(screen.getByRole('button', { name: /Abwerfen/ })).toHaveProperty('disabled', false);
    // Vier von vier: mehr geht nirgends mehr, und man sieht es.
    expect(screen.getByLabelText('Holz mehr')).toHaveProperty('disabled', true);
    expect(screen.getByLabelText('Korn mehr')).toHaveProperty('disabled', true);
    // Zuruecknehmen bleibt offen.
    expect(screen.getByLabelText('Holz weniger')).toHaveProperty('disabled', false);
  });
});

/*
 * Aus dem Durchgangsbericht (Aufgabe 16, Befund C): bei einer Sieben stand
 * der Dialog manchmal mit einer Sorte da, die mehr enthielt, als vorhanden
 * war ("Holz von 1" bei ausgewaehlten 2) - der "Abwerfen"-Knopf blieb
 * bedienbar (die Summe stimmte), aber jeder Klick wurde vom Server
 * stillschweigend abgelehnt. Zwei Haelften, zwei Tests: die Auswahl darf so
 * gar nicht erst entstehen, und der Knopf muss gesperrt bleiben, falls sie
 * es doch tut (etwa weil der Bestand von aussen schrumpft, waehrend die
 * Auswahl steht).
 */
describe('DiscardDialog, Befund C (Aufgabe 16)', () => {
  it('laesst eine Sorte nicht ueber den Bestand steigen, wenn zwei Klicks im selben Schub landen', () => {
    render(<DiscardDialog player={player} cards={RESOURCE_IDS} required={4} onConfirm={vi.fn()} />);

    // Korn liegt genau einmal auf der Hand (siehe `player` oben).
    const plus = screen.getByLabelText('Korn mehr');

    /*
     * Zwei rohe `click`-Ereignisse in einem einzigen `act`, statt zwei
     * einzeln erwarteter `userEvent.click`s: Letztere flushen dazwischen
     * neu - das simuliert also nicht die Lage aus dem Durchgang, in der
     * zwei `click`-Ereignisse im selben Schub landeten (Doppel-Klick, oder
     * ein Browser, der fuer eine Geste zwei Ereignisse ausliefert). Vor der
     * Behebung liess das `chosen.grain` auf 2 klettern, obwohl nur eine
     * Kornkarte auf der Hand lag.
     */
    act(() => {
      plus.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      plus.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(screen.getByTestId('chosen-grain').textContent).toBe('1');
  });

  it('sperrt "Abwerfen", solange eine gewaehlte Sorte ueber dem Bestand steht', () => {
    const onConfirm = vi.fn();
    const { rerender } = render(
      <DiscardDialog player={player} cards={RESOURCE_IDS} required={1} onConfirm={onConfirm} />,
    );

    // Ein Lehm gewaehlt, waehrend drei auf der Hand liegen - gueltig.
    fireEvent.click(screen.getByLabelText('Lehm mehr'));
    expect(screen.getByRole('button', { name: /Abwerfen/ })).toHaveProperty('disabled', false);

    /*
     * Der Bestand schrumpft von aussen (derselbe Sitz bleibt gerendert,
     * kein neuer `key` - wie in `GameScreen.tsx`, solange `view.you`
     * gleich bleibt), waehrend die Auswahl stehen bleibt: genau die Lage,
     * in der ein Klick auf "Abwerfen" bislang lautlos ins Leere lief.
     */
    const poorer: PlayerRow = {
      ...player,
      resources: cardAmounts({ ...player.resources, brick: 0 }),
    };
    rerender(
      <DiscardDialog player={poorer} cards={RESOURCE_IDS} required={1} onConfirm={onConfirm} />,
    );

    expect(screen.getByRole('button', { name: /Abwerfen/ })).toHaveProperty('disabled', true);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('TradeDialog', () => {
  it('zeigt den abgeleiteten Kurs und schickt nur die Absicht', async () => {
    const onConfirm = vi.fn();
    const rateFor = (give: CardId): number => (give === 'brick' ? 2 : 4);

    render(
      <TradeDialog
        player={player}
        cards={RESOURCE_IDS}
        rateFor={rateFor}
        canTrade={(give, receive) => give !== receive}
        canOffer={false}
        onOffer={vi.fn()}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByLabelText('Lehm abgeben'));
    await userEvent.click(screen.getByLabelText('Erz bekommen'));

    expect(screen.getByTestId('rate').textContent).toContain('2:1');
    await userEvent.click(screen.getByRole('button', { name: /Tauschen/ }));

    expect(onConfirm).toHaveBeenCalledWith('brick', 'ore');
  });

  /*
   * **Der Bankhandel war die einzige Stelle, an der ein Rohstoff keine Farbe
   * hatte.** Fuenf gleiche Pergamentpillen mit Text darin - waehrend derselbe
   * Rohstoff auf der Hand und in „Erfindung"/„Monopol" eine Karte in der
   * Gelaendefarbe mit seinem Motiv ist. Gemeldet als „weiss auf weiss".
   *
   * Geprueft wird nicht, *welche* Farbe (die steht in `labels.ts` und waere hier
   * nur abgeschrieben), sondern dass es fuenf verschiedene sind und keine
   * fehlt - genau das war kaputt.
   */
  it('gibt jeder Sorte im Bankhandel ihre Farbe und ihr Motiv', () => {
    render(
      <TradeDialog
        player={player}
        cards={RESOURCE_IDS}
        rateFor={() => 4}
        canTrade={() => true}
        canOffer={false}
        onOffer={vi.fn()}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // Die Karte sitzt seit der gemeinsamen `ResourceCard` **im** Label und ist
    // nicht mehr das Label selbst - die Huelle traegt die Auswahl, der Koerper
    // die Farbe.
    const cards = RESOURCE_IDS.map(
      (resource) =>
        screen
          .getByLabelText(`${RESOURCE_LABELS[resource]} abgeben`)
          .closest('label')!
          .querySelector('.rescard') as HTMLElement,
    );

    for (const card of cards) {
      expect(card.querySelector('.card__glyph')).not.toBeNull();
      expect(card.style.background).not.toBe('');
    }

    expect(new Set(cards.map((card) => card.style.background)).size).toBe(RESOURCE_IDS.length);
  });

  /*
   * Der Weg zurueck aus einem versehentlich geoeffneten Fenster - gemeldet aus
   * dem ersten Playtest. Zwei Wege, weil beide fehlen koennen: die Maus findet
   * das Kreuz, die Tastatur die Taste.
   */
  it('schliesst sich ueber das Kreuz in der Ecke', async () => {
    const onClose = vi.fn();
    render(
      <TradeDialog
        player={player}
        cards={RESOURCE_IDS}
        rateFor={() => 4}
        canTrade={() => true}
        canOffer={false}
        onOffer={vi.fn()}
        onConfirm={vi.fn()}
        onClose={onClose}
      />,
    );

    await userEvent.click(screen.getByTestId('modal-close'));

    expect(onClose).toHaveBeenCalled();
  });

  it('schliesst sich mit Escape', async () => {
    const onClose = vi.fn();
    render(
      <TradeDialog
        player={player}
        cards={RESOURCE_IDS}
        rateFor={() => 4}
        canTrade={() => true}
        canOffer={false}
        onOffer={vi.fn()}
        onConfirm={vi.fn()}
        onClose={onClose}
      />,
    );

    await userEvent.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });
});

describe('AccountDialog', () => {
  it('fragt beim Anlegen zusaetzlich nach der freiwilligen E-Mail', () => {
    render(
      <AccountDialog
        mode="register"
        openGuestGames={0}
        problem={null}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/E-Mail/)).toBeTruthy();
  });

  it('fragt beim Anmelden nicht nach der E-Mail', () => {
    render(
      <AccountDialog
        mode="login"
        openGuestGames={0}
        problem={null}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText(/E-Mail/)).toBeNull();
  });

  it('warnt vor dem Anmelden, wenn als Gast noch Partien offen sind', () => {
    render(
      <AccountDialog
        mode="login"
        openGuestGames={2}
        problem={null}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/2 offene Partien/)).toBeTruthy();
  });

  it('schickt die Bestaetigung mit, wenn gewarnt wurde', async () => {
    const onSubmit = vi.fn();
    render(
      <AccountDialog
        mode="login"
        openGuestGames={2}
        problem={null}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    );

    await userEvent.type(screen.getByLabelText(/Benutzername/), 'anna');
    await userEvent.type(screen.getByLabelText(/Passwort/), 'langgenug1');
    await userEvent.click(screen.getByRole('button', { name: 'Trotzdem anmelden' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ login: 'anna', confirmAbandonGuest: true }),
    );
  });

  it('schickt keine Bestaetigung mit, wenn gar nicht gewarnt wurde', async () => {
    const onSubmit = vi.fn();
    render(
      <AccountDialog
        mode="login"
        openGuestGames={0}
        problem={null}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    );

    await userEvent.type(screen.getByLabelText(/Benutzername/), 'anna');
    await userEvent.type(screen.getByLabelText(/Passwort/), 'langgenug1');
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    // Nicht nur "confirmAbandonGuest ist nicht true" - der Schluessel darf
    // im gesendeten Objekt gar nicht erst auftauchen. `objectContaining`
    // (auch negiert) prueft Abwesenheit korrekt; ein fest verdrahtetes
    // `confirmAbandonGuest: true` wuerde diesen Test rot werden lassen.
    expect(onSubmit).toHaveBeenCalledWith(
      expect.not.objectContaining({ confirmAbandonGuest: expect.anything() }),
    );
  });

  it('zeigt die Absage des Servers, statt sie zu verschlucken', () => {
    render(
      <AccountDialog
        mode="register"
        openGuestGames={0}
        problem="Dieser Benutzername ist vergeben."
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Dieser Benutzername ist vergeben.')).toBeTruthy();
  });
});

describe('TradeDialog, Reiter Spieler', () => {
  const props = {
    player,
    cards: RESOURCE_IDS,
    rateFor: () => 4,
    canTrade: () => true,
    onConfirm: vi.fn(),
    onClose: vi.fn(),
  };

  it('zeigt die Reiter nicht, wenn kein Angebot moeglich waere', () => {
    render(<TradeDialog {...props} canOffer={false} onOffer={vi.fn()} />);

    expect(screen.queryByRole('tab', { name: 'Spieler' })).toBeNull();
  });

  it('schickt die gewaehlten Mengen hinaus', async () => {
    const onOffer = vi.fn();
    render(<TradeDialog {...props} canOffer onOffer={onOffer} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Spieler' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lehm mehr anbieten' }));
    await userEvent.click(screen.getByRole('button', { name: 'Erz mehr verlangen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Angebot auf den Tisch legen' }));

    expect(onOffer).toHaveBeenCalledWith(
      cardAmounts({ brick: 1, lumber: 0, wool: 0, grain: 0, ore: 0 }),
      cardAmounts({ brick: 0, lumber: 0, wool: 0, grain: 0, ore: 1 }),
    );
  });

  it('haelt den Knopf gesperrt, solange eine Seite leer ist', async () => {
    render(<TradeDialog {...props} canOffer onOffer={vi.fn()} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Spieler' }));
    expect(screen.getByRole('button', { name: 'Angebot auf den Tisch legen' })).toHaveProperty(
      'disabled',
      true,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Lehm mehr anbieten' }));
    expect(screen.getByRole('button', { name: 'Angebot auf den Tisch legen' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('sperrt den Knopf, wenn dieselbe Sorte auf beiden Seiten stuende', async () => {
    render(<TradeDialog {...props} canOffer onOffer={vi.fn()} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Spieler' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lehm mehr anbieten' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lehm mehr verlangen' }));

    expect(screen.getByRole('button', { name: 'Angebot auf den Tisch legen' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('gibt nicht mehr her, als auf der Hand liegt', async () => {
    render(<TradeDialog {...props} canOffer onOffer={vi.fn()} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Spieler' }));
    // Der Spieler haelt kein Erz.
    await userEvent.click(screen.getByRole('button', { name: 'Erz mehr anbieten' }));

    expect(screen.getByTestId('give-ore').textContent).toBe('0');
  });
});

/**
 * Der Weg zurueck darf nie gesperrt sein.
 *
 * Im Browser-Durchgang zu 10b stand der Abwurfdialog auf „Abwerfen (40/4)",
 * und **jeder** Knopf war grau - auch das Minus unter der Vierzig. Die Ursache:
 * `canStep` prueft `next > held` in beide Richtungen, und damit sperrt sie
 * genau den Weg aus einem zu hohen Wert heraus. Der Dialog war eine Sackgasse.
 *
 * Erreicht hat ihn ein Treiber, der vierzig Klicks in einen Frame legte - ein
 * Mensch schafft das nicht. Die Regel bleibt trotzdem falsch: eine Pruefung,
 * die das Verlassen eines ungueltigen Zustands verbietet, ist keine Grenze,
 * sondern eine Falle.
 */
describe('DiscardDialog, der Weg zurueck', () => {
  it('laesst herunterzaehlen, auch wenn der Wert ueber dem Vorrat steht', async () => {
    render(<DiscardDialog player={player} cards={RESOURCE_IDS} required={4} onConfirm={vi.fn()} />);

    // Korn gibt es genau einmal - eins geht, ein zweites nicht.
    await userEvent.click(screen.getByLabelText('Korn mehr'));
    expect(screen.getByTestId('chosen-grain').textContent).toBe('1');
    expect(screen.getByLabelText('Korn mehr')).toHaveProperty('disabled', true);

    // Und der Rueckweg steht offen.
    expect(screen.getByLabelText('Korn weniger')).toHaveProperty('disabled', false);
    await userEvent.click(screen.getByLabelText('Korn weniger'));
    expect(screen.getByTestId('chosen-grain').textContent).toBe('0');
  });

  it('sperrt das Minus erst bei null', async () => {
    render(<DiscardDialog player={player} cards={RESOURCE_IDS} required={4} onConfirm={vi.fn()} />);

    expect(screen.getByLabelText('Lehm weniger')).toHaveProperty('disabled', true);
    await userEvent.click(screen.getByLabelText('Lehm mehr'));
    expect(screen.getByLabelText('Lehm weniger')).toHaveProperty('disabled', false);
  });

  it('haelt den Rueckweg offen, wenn die geforderte Zahl erreicht ist', async () => {
    render(<DiscardDialog player={player} cards={RESOURCE_IDS} required={4} onConfirm={vi.fn()} />);

    for (const label of ['Lehm mehr', 'Lehm mehr', 'Lehm mehr', 'Holz mehr']) {
      await userEvent.click(screen.getByLabelText(label));
    }

    // Voll: nach oben ist zu, nach unten offen.
    expect(screen.getByLabelText('Holz mehr')).toHaveProperty('disabled', true);
    expect(screen.getByLabelText('Lehm weniger')).toHaveProperty('disabled', false);
  });
});
