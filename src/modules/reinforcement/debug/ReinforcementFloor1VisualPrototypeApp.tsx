import { useEffect, useRef, useState } from 'react';
import * as Phaser from 'phaser';
import { LOGICAL } from '../../../config';
import { ReinforcementFloor1VisualPrototypeScene } from './ReinforcementFloor1VisualPrototypeScene';

export function ReinforcementFloor1VisualPrototypeApp() {
  const mount = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Loading Floor 1 visual prototype...');

  useEffect(() => {
    const ready = () => setStatus('Floor 1 visual prototype ready');
    const failed = (event: ErrorEvent) => setStatus(`ERROR: ${event.message}`);
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: mount.current!,
      width: LOGICAL.width,
      height: LOGICAL.height,
      backgroundColor: '#151a1e',
      pixelArt: true,
      roundPixels: true,
      physics: { default: 'arcade', arcade: { debug: false } },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [ReinforcementFloor1VisualPrototypeScene],
    });
    game.events.once('reinforcement-floor1-visual-prototype-ready', ready);
    window.addEventListener('error', failed);
    return () => {
      window.removeEventListener('error', failed);
      game.events.off('reinforcement-floor1-visual-prototype-ready', ready);
      game.destroy(true);
    };
  }, []);

  return <main className="stage" aria-label="Reinforcement Floor 1 Visual Prototype">
    <div ref={mount} className="game" />
    <output data-testid="reinforcement-floor1-visual-status" style={{ position: 'absolute', right: 8, bottom: 8, zIndex: 30, padding: '4px 7px', background: '#151a1edd', font: '12px monospace' }}>{status}</output>
  </main>;
}
