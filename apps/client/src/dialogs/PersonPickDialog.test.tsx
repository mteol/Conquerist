// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent } from '../test/dom';
import { PersonPickDialog } from './PersonPickDialog';

const people = [
  { id: 'p2', name: 'Ben', color: 'rgb(0, 0, 255)', victoryPoints: 5 },
  { id: 'p3', name: 'Cem', color: 'rgb(0, 128, 0)', victoryPoints: 1 },
];

describe('PersonPickDialog', () => {
  it('nennt jede Person mit Namen und Punktestand', () => {
    render(
      <PersonPickDialog title="Spionage: bei wem?" hint="" people={people} onChoose={vi.fn()} onClose={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Ben · 5 Siegpunkte' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cem · 1 Siegpunkt' })).toBeDefined();
  });

  it('meldet die gewählte Person', async () => {
    const onChoose = vi.fn();
    render(
      <PersonPickDialog title="Spionage: bei wem?" hint="" people={people} onChoose={onChoose} onClose={vi.fn()} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Ben/ }));

    expect(onChoose).toHaveBeenCalledWith('p2');
  });

  it('lässt sich abbrechen', async () => {
    const onClose = vi.fn();
    render(
      <PersonPickDialog title="Spionage: bei wem?" hint="" people={people} onChoose={vi.fn()} onClose={onClose} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(onClose).toHaveBeenCalled();
  });
});
