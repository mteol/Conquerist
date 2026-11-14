/**
 * Das ganze Stylesheet als Text, in der Reihenfolge der Kaskade.
 *
 * `index.css` besteht nur noch aus Importen; Tests, die pruefen, dass eine
 * Regel im Blatt steht (jsdom wertet keine Media Query aus), lesen deshalb
 * hier. Wer in `index.css` eine Datei ergaenzt, ergaenzt sie auch hier -
 * `stylesheet.test.ts` haelt beide Listen zusammen.
 */
import tokens from '../styles/tokens.css?raw';
import base from '../styles/base.css?raw';
import system from '../styles/system.css?raw';
import start from '../styles/start.css?raw';
import menu from '../styles/menu.css?raw';
import cards from '../styles/cards.css?raw';
import mode from '../styles/mode.css?raw';
import lobby from '../styles/lobby.css?raw';
import gameLayout from '../styles/game-layout.css?raw';
import tray from '../styles/tray.css?raw';
import hud from '../styles/hud.css?raw';
import dice from '../styles/dice.css?raw';
import log from '../styles/log.css?raw';
import board from '../styles/board.css?raw';
import dialogs from '../styles/dialogs.css?raw';
import misc from '../styles/misc.css?raw';

/** Name der Datei unter `styles/` und ihr Text, in Importreihenfolge. */
export const STYLESHEET_PARTS: readonly (readonly [string, string])[] = [
  ['tokens', tokens],
  ['base', base],
  ['system', system],
  ['start', start],
  ['menu', menu],
  ['cards', cards],
  ['mode', mode],
  ['lobby', lobby],
  ['game-layout', gameLayout],
  ['tray', tray],
  ['hud', hud],
  ['dice', dice],
  ['log', log],
  ['board', board],
  ['dialogs', dialogs],
  ['misc', misc],
];

export const stylesheet: string = STYLESHEET_PARTS.map(([, text]) => text).join('\n');
