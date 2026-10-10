import { useEffect, useRef, useState } from 'react';
import * as Phaser from 'phaser';
import { LOGICAL } from '../../../config';
import { ReinforcementFloor4DebugScene } from './ReinforcementFloor4DebugScene';

export function ReinforcementFloor4DebugApp() {
  const mount = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [status, setStatus] = useState('Loading Floor 4...');

  useEffect(() => {
    const ready = (side: string) => setStatus(`Floor 4 debug ready · ${side} arrival`);
    const routeStarted = (route: string) => setStatus(`RUNNING · ${route}`);
    const routeComplete = (route: string, target: string) => setStatus(`PASS · ${route} → ${target}`);
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
      scene: [ReinforcementFloor4DebugScene],
    });
    game.canvas.tabIndex = 0;
    game.canvas.setAttribute('aria-label', 'Floor 4 debug canvas');
    game.canvas.focus();
    gameRef.current = game;
    game.events.once('reinforcement-floor4-debug-ready', ready);
    game.events.on('reinforcement-floor4-route-probe-start', routeStarted);
    game.events.on('reinforcement-floor4-route-probe-complete', routeComplete);
    game.events.on('reinforcement-floor4-overlay-changed', overlayChanged);
    game.events.once('reinforcement-floor4-debug-error', sceneFailed);
    window.addEventListener('error', failed);
    return () => {
      window.removeEventListener('error', failed);
      game.events.off('reinforcement-floor4-debug-ready', ready);
      game.events.off('reinforcement-floor4-debug-error', sceneFailed);
      game.events.off('reinforcement-floor4-route-probe-start', routeStarted);
      game.events.off('reinforcement-floor4-route-probe-complete', routeComplete);
      game.events.off('reinforcement-floor4-overlay-changed', overlayChanged);
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <main className="stage" aria-label="Reinforcement Floor 4 Debug Playtest">
    <div ref={mount} className="game" />
    <nav aria-label="Floor 4 route probes" style={{ position: 'absolute', left: 8, bottom: 8, zIndex: 30, display: 'flex', gap: 4 }}>
      {([
        ['L short', 'F4_SECURITY_HALL_ROUTE'], ['L long', 'F4_PERIMETER_DETOUR_ROUTE'],
        ['R short', 'F4_INNER_SECURITY_ROUTE'], ['R long', 'F4_SERVICE_ROUTE'],
      ] as const).map(([label, route]) => <button key={route} type="button" onClick={() => gameRef.current?.events.emit('reinforcement-floor4-run-route', route)}>{label}</button>)}
      {(['Collision', 'Navigation', 'Encounters'] as const).map(overlay => <button key={overlay} type="button" onClick={() => gameRef.current?.events.emit('reinforcement-floor4-toggle-overlay', overlay)}>{overlay}</button>)}
      <button type="button" onClick={() => gameRef.current?.events.emit('reinforcement-floor4-run-stair')}>Guard→Stair</button>
    </nav>
    <output data-testid="reinforcement-floor4-status" style={{ position: 'absolute', right: 8, bottom: 8, zIndex: 30, padding: '4px 7px', background: '#071018dd', font: '12px monospace' }}>{status}</output>
  </main>;
}
