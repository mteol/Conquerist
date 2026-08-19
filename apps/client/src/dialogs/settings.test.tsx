// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, userEvent } from '../test/dom';
import { AudioProvider } from '../audio/useAudio';
import { SettingsButton } from '../screens/SettingsButton';

vi.mock('../audio/engine', () => ({
  createEngine: () => ({
    play: () => {},
    playMusic: () => {},
    apply: () => {},
    close: () => {},
  }),
}));

const openSettings = async (): Promise<void> => {
  render(
    <AudioProvider>
      <SettingsButton />
    </AudioProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Einstellungen' }));
};

const sliderFor = (label: string): HTMLInputElement =>
  screen.getByRole('slider', { name: label }) as HTMLInputElement;

describe('Einstellungen', () => {
  it('zeigt drei Regler mit ihren Namen', async () => {
    await openSettings();

    expect(sliderFor('Gesamt')).toBeDefined();
    expect(sliderFor('Effekte')).toBeDefined();
    expect(sliderFor('Musik')).toBeDefined();
  });

  it('bewegt einen Regler und zeigt den Wert an', async () => {
    await openSettings();

    fireEvent.change(sliderFor('Effekte'), { target: { value: '40' } });

    expect(sliderFor('Effekte').value).toBe('40');
    expect(screen.getByText('40 %')).toBeDefined();
  });

  it('schaltet stumm, ohne den Wert zu verlieren', async () => {
    await openSettings();
    fireEvent.change(sliderFor('Gesamt'), { target: { value: '55' } });

    const mute = screen.getByRole('button', { name: 'Gesamt stummschalten' });
    await userEvent.click(mute);

    expect(mute.getAttribute('aria-pressed')).toBe('true');
    // Der Regler behaelt seine Stellung: Aufheben stellt sie wieder her.
    expect(sliderFor('Gesamt').value).toBe('55');
  });

  it('merkt sich die Werte ueber das Schliessen hinaus', async () => {
    await openSettings();
    fireEvent.change(sliderFor('Musik'), { target: { value: '20' } });

    await userEvent.click(screen.getByTestId('modal-close'));
    await userEvent.click(screen.getByRole('button', { name: 'Einstellungen' }));

    expect(sliderFor('Musik').value).toBe('20');
  });

  it('legt die Werte in den Speicher, damit sie ein Neuladen ueberleben', async () => {
    await openSettings();

    fireEvent.change(sliderFor('Effekte'), { target: { value: '30' } });

    expect(JSON.parse(window.localStorage.getItem('conquerist.audio')!).sfx.level).toBeCloseTo(0.3);
  });
});
