import { useEffect, useRef, useState } from 'react';
import * as Phaser from 'phaser';
import { LOGICAL } from '../../../config';
import { ReinforcementFloor1DebugScene } from './ReinforcementFloor1DebugScene';

export function ReinforcementFloor1DebugApp() {
  const mount = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Loading Floor 1...');

  useEffect(() => {
    const ready = () => setStatus('Floor 1 debug ready');
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
      scene: [ReinforcementFloor1DebugScene],
    });
    game.events.once('reinforcement-floor1-debug-ready', ready);
    game.events.once('reinforcement-floor1-debug-error', sceneFailed);
    window.addEventListener('error', failed);
    return () => {
      window.removeEventListener('error', failed);
      game.events.off('reinforcement-floor1-debug-ready', ready);
      game.events.off('reinforcement-floor1-debug-error', sceneFailed);
      game.destroy(true);
    };
  }, []);

  return <main className="stage" aria-label="Reinforcement Floor 1 Debug Playtest">
    <div ref={mount} className="game" />
    <output data-testid="reinforcement-floor1-status" style={{ position: 'absolute', right: 8, bottom: 8, zIndex: 30, padding: '4px 7px', background: '#071018dd', font: '12px monospace' }}>{status}</output>
  </main>;
}
