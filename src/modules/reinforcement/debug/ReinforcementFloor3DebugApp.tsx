import { useEffect, useRef, useState } from 'react';
import * as Phaser from 'phaser';
import { LOGICAL } from '../../../config';
import { ReinforcementFloor3DebugScene } from './ReinforcementFloor3DebugScene';

export function ReinforcementFloor3DebugApp() {
  const mount = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [status, setStatus] = useState('Loading Floor 3...');

  useEffect(() => {
    const ready = () => setStatus('Floor 3 debug ready · CENTER arrival');
    const routeStarted = (route: string) => setStatus(`RUNNING · ${route}`);
    const routeComplete = (route: string, target: string) => setStatus(`PASS · ${route} → ${target}`);
    const routeBlocked = (probe: string) => setStatus(`PASS · ${probe} blocked by facility-room collision`);
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
      scene: [ReinforcementFloor3DebugScene],
    });
    game.canvas.tabIndex = 0;
    game.canvas.setAttribute('aria-label', 'Floor 3 debug canvas');
    game.canvas.focus();
    gameRef.current = game;
    game.events.once('reinforcement-floor3-debug-ready', ready);
    game.events.on('reinforcement-floor3-route-probe-start', routeStarted);
    game.events.on('reinforcement-floor3-route-probe-complete', routeComplete);
    game.events.on('reinforcement-floor3-route-probe-blocked', routeBlocked);
    game.events.on('reinforcement-floor3-overlay-changed', overlayChanged);
    game.events.once('reinforcement-floor3-debug-error', sceneFailed);
    window.addEventListener('error', failed);
    return () => {
      window.removeEventListener('error', failed);
      game.events.off('reinforcement-floor3-debug-ready', ready);
      game.events.off('reinforcement-floor3-debug-error', sceneFailed);
      game.events.off('reinforcement-floor3-route-probe-start', routeStarted);
      game.events.off('reinforcement-floor3-route-probe-complete', routeComplete);
      game.events.off('reinforcement-floor3-route-probe-blocked', routeBlocked);
      game.events.off('reinforcement-floor3-overlay-changed', overlayChanged);
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <main className="stage" aria-label="Reinforcement Floor 3 Debug Playtest">
    <div ref={mount} className="game" />
    <nav aria-label="Floor 3 route probes" style={{ position: 'absolute', left: 8, bottom: 8, zIndex: 30, display: 'flex', gap: 4 }}>
      <button type="button" onClick={() => gameRef.current?.events.emit('reinforcement-floor3-run-route', 'F3_LEFT_MAINTENANCE_ROUTE')}>LEFT short</button>
      <button type="button" onClick={() => gameRef.current?.events.emit('reinforcement-floor3-run-route', 'F3_RIGHT_PERIMETER_ROUTE')}>RIGHT long</button>
      {(['Collision', 'Navigation', 'Encounters'] as const).map(overlay => <button key={overlay} type="button" onClick={() => gameRef.current?.events.emit('reinforcement-floor3-toggle-overlay', overlay)}>{overlay}</button>)}
      <button type="button" onClick={() => gameRef.current?.events.emit('reinforcement-floor3-run-stair', 'LEFT')}>L Guard→Stair</button>
      <button type="button" onClick={() => gameRef.current?.events.emit('reinforcement-floor3-run-stair', 'RIGHT')}>R Guard→Stair</button>
      <button type="button" onClick={() => gameRef.current?.events.emit('reinforcement-floor3-run-room')}>GREEN room</button>
    </nav>
    <output data-testid="reinforcement-floor3-status" style={{ position: 'absolute', right: 8, bottom: 8, zIndex: 30, padding: '4px 7px', background: '#071018dd', font: '12px monospace' }}>{status}</output>
  </main>;
}
