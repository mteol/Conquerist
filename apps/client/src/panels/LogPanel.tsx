import type { JSX } from 'react';
import type { LogEntry } from '../game/hotseat';

/** Der Verlauf, juengster Eintrag oben. Mehr als zwanzig braucht niemand im Blick. */
export function LogPanel({ entries }: { readonly entries: readonly LogEntry[] }): JSX.Element {
  const recent = entries.slice(-20).reverse();

  return (
    <section className="panel panel--log">
      <h2 className="panel__title">Verlauf</h2>
      <ol className="log">
        {recent.map((entry, index) => (
          <li key={entries.length - index} className="log__entry">
            {entry.text}
          </li>
        ))}
      </ol>
    </section>
  );
}
