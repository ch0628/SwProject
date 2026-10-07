import { useEffect, useRef, useState } from 'react';
import * as Phaser from 'phaser';
import { LOGICAL } from '../../../config';
import { ReinforcementFloor1VisualShellScene } from './ReinforcementFloor1VisualShellScene';

export function ReinforcementFloor1VisualShellApp() {
  const mount = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Loading Tiled room-shell prototype...');

  useEffect(() => {
    const ready = () => setStatus('Tiled room-shell prototype ready');
    const failed = (message: string) => setStatus(`ERROR: ${message}`);
    const game = new Phaser.Game({
      type: Phaser.AUTO, parent: mount.current!, width: LOGICAL.width, height: LOGICAL.height,
      backgroundColor: '#151a1e', pixelArt: true, roundPixels: true,
      physics: { default: 'arcade', arcade: { debug: false } },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [ReinforcementFloor1VisualShellScene],
    });
    game.events.once('reinforcement-floor1-visual-shell-ready', ready);
    game.events.once('reinforcement-floor1-visual-shell-error', failed);
    return () => { game.destroy(true); };
  }, []);

  return <main className="stage" aria-label="Reinforcement Floor 1 Tiled Room Shell Prototype">
    <div ref={mount} className="game" />
    <output data-testid="reinforcement-floor1-visual-shell-status" style={{ position: 'absolute', right: 8, bottom: 8, zIndex: 30, padding: '4px 7px', background: '#151a1edd', font: '12px monospace' }}>{status}</output>
  </main>;
}
