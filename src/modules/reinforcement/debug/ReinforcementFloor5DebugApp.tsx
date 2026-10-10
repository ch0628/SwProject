import { useEffect, useRef, useState } from 'react';
import * as Phaser from 'phaser';
import { LOGICAL } from '../../../config';
import { ReinforcementFloor5DebugScene } from './ReinforcementFloor5DebugScene';
import type { Floor5ProbeKind, Floor5RoomId } from './floor5Tiled';

export function ReinforcementFloor5DebugApp() {
  const mount = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [status, setStatus] = useState('Loading Floor 5...');

  useEffect(() => {
    const ready = () => setStatus('Floor 5 debug ready · Boss location hidden');
    const probeStarted = (probe: string) => setStatus(`RUNNING · ${probe}`);
    const probeComplete = (probe: string, target: string) => setStatus(`PASS · ${probe} → ${target}`);
    const overlayChanged = (overlay: string, enabled: boolean) => setStatus(`${overlay} overlay · ${enabled ? 'ON' : 'OFF'}`);
    const sceneFailed = (message: string) => setStatus(`ERROR: ${message}`);
    const failed = (event: ErrorEvent) => setStatus(`ERROR: ${event.message}`);
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: mount.current!,
      width: LOGICAL.width,
      height: LOGICAL.height,
      backgroundColor: '#071018',
      pixelArt: true,
      roundPixels: true,
      physics: { default: 'arcade', arcade: { debug: false } },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [ReinforcementFloor5DebugScene],
    });
    game.canvas.tabIndex = 0;
    game.canvas.setAttribute('aria-label', 'Floor 5 debug canvas');
    game.canvas.focus();
    gameRef.current = game;
    game.events.once('reinforcement-floor5-debug-ready', ready);
    game.events.on('reinforcement-floor5-probe-start', probeStarted);
    game.events.on('reinforcement-floor5-probe-complete', probeComplete);
    game.events.on('reinforcement-floor5-overlay-changed', overlayChanged);
    game.events.once('reinforcement-floor5-debug-error', sceneFailed);
    window.addEventListener('error', failed);
    return () => {
      window.removeEventListener('error', failed);
      game.events.off('reinforcement-floor5-debug-ready', ready);
      game.events.off('reinforcement-floor5-debug-error', sceneFailed);
      game.events.off('reinforcement-floor5-probe-start', probeStarted);
      game.events.off('reinforcement-floor5-probe-complete', probeComplete);
      game.events.off('reinforcement-floor5-overlay-changed', overlayChanged);
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  const run = (room: Floor5RoomId, kind: Floor5ProbeKind) => gameRef.current?.events.emit('reinforcement-floor5-run-probe', { room, kind });

  return <main className="stage" aria-label="Reinforcement Floor 5 Debug Playtest">
    <div ref={mount} className="game" />
    <nav aria-label="Floor 5 probes" style={{ position: 'absolute', left: 8, bottom: 8, zIndex: 30, display: 'flex', gap: 4 }}>
      {(['L1', 'L2', 'R1', 'R2'] as const).map(room => <button key={room} type="button" onClick={() => run(room, 'SEARCH')}>{room}</button>)}
      <button type="button" onClick={() => run('L1', 'NO_BOSS')}>NO_BOSS return</button>
      <button type="button" onClick={() => run('L1', 'POST_BOSS')}>POST_BOSS → Goal</button>
      {(['Collision', 'Navigation', 'Encounters'] as const).map(overlay => <button key={overlay} type="button" onClick={() => gameRef.current?.events.emit('reinforcement-floor5-toggle-overlay', overlay)}>{overlay}</button>)}
      <button type="button" onClick={() => gameRef.current?.events.emit('reinforcement-floor5-reset')}>Reset</button>
    </nav>
    <output data-testid="reinforcement-floor5-status" style={{ position: 'absolute', right: 8, bottom: 8, zIndex: 30, padding: '4px 7px', background: '#071018dd', font: '12px monospace' }}>{status}</output>
  </main>;
}
