import { useEffect, useRef, useState } from 'react';
import * as Phaser from 'phaser';
import { LOGICAL } from '../../../config';
import { ReinforcementFloor2DebugScene } from './ReinforcementFloor2DebugScene';

export function ReinforcementFloor2DebugApp() {
  const mount = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [status, setStatus] = useState('Loading Floor 2...');

  useEffect(() => {
    const ready = (side: string) => setStatus(`Floor 2 debug ready · ${side} arrival`);
    const routeStarted = (route: string) => setStatus(`RUNNING · ${route}`);
    const routeProgress = (route: string, index: number, total: number, x: number, y: number, detail = '') => setStatus(`RUNNING ${index}/${total} · ${route} · ${x},${y}${detail ? ` · ${detail}` : ''}`);
    const routeComplete = (route: string, target = 'F2_CENTER_GUARD') => setStatus(`PASS · ${route} → ${target}`);
    const routeBlocked = (probe: string) => setStatus(`PASS · ${probe} blocked by room collision`);
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
      scene: [ReinforcementFloor2DebugScene],
    });
    game.canvas.tabIndex = 0;
    game.canvas.setAttribute('aria-label', 'Floor 2 debug canvas');
    game.canvas.focus();
    gameRef.current = game;
    game.events.once('reinforcement-floor2-debug-ready', ready);
    game.events.on('reinforcement-floor2-route-probe-start', routeStarted);
    game.events.on('reinforcement-floor2-route-probe-progress', routeProgress);
    game.events.on('reinforcement-floor2-route-probe-complete', routeComplete);
    game.events.on('reinforcement-floor2-route-probe-blocked', routeBlocked);
    game.events.on('reinforcement-floor2-overlay-changed', overlayChanged);
    game.events.once('reinforcement-floor2-debug-error', sceneFailed);
    window.addEventListener('error', failed);
    return () => {
      window.removeEventListener('error', failed);
      game.events.off('reinforcement-floor2-debug-ready', ready);
      game.events.off('reinforcement-floor2-debug-error', sceneFailed);
      game.events.off('reinforcement-floor2-route-probe-start', routeStarted);
      game.events.off('reinforcement-floor2-route-probe-progress', routeProgress);
      game.events.off('reinforcement-floor2-route-probe-complete', routeComplete);
      game.events.off('reinforcement-floor2-route-probe-blocked', routeBlocked);
      game.events.off('reinforcement-floor2-overlay-changed', overlayChanged);
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <main className="stage" aria-label="Reinforcement Floor 2 Debug Playtest">
    <div ref={mount} className="game" />
    <nav aria-label="Floor 2 route probes" style={{ position: 'absolute', left: 8, bottom: 8, zIndex: 30, display: 'flex', gap: 4 }}>
      {([
        ['L short', 'F2_DIRECT_OFFICE_ROUTE'], ['L long', 'F2_OUTER_CORRIDOR_ROUTE'],
        ['R short', 'F2_INNER_HALL_ROUTE'], ['R long', 'F2_SERVICE_DETOUR_ROUTE'],
      ] as const).map(([label, route]) => <button key={route} type="button" onClick={() => gameRef.current?.events.emit('reinforcement-floor2-run-route', route)}>{label}</button>)}
      {(['Collision', 'Navigation', 'Encounters'] as const).map(overlay => <button key={overlay} type="button" onClick={() => gameRef.current?.events.emit('reinforcement-floor2-toggle-overlay', overlay)}>{overlay}</button>)}
      <button type="button" onClick={() => gameRef.current?.events.emit('reinforcement-floor2-run-stair')}>Guard→Stair</button>
      <button type="button" onClick={() => gameRef.current?.events.emit('reinforcement-floor2-run-door', 'LEFT')}>L room</button>
      <button type="button" onClick={() => gameRef.current?.events.emit('reinforcement-floor2-run-door', 'RIGHT')}>R room</button>
    </nav>
    <output data-testid="reinforcement-floor2-status" style={{ position: 'absolute', right: 8, bottom: 8, zIndex: 30, padding: '4px 7px', background: '#071018dd', font: '12px monospace' }}>{status}</output>
  </main>;
}
