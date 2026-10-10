import { useEffect, useRef, useState } from 'react';
import * as Phaser from 'phaser';
import { LOGICAL } from '../../../config';
import { ReinforcementFloor1DebugScene } from './ReinforcementFloor1DebugScene';
import { ReinforcementFloor2DebugScene } from './ReinforcementFloor2DebugScene';
import { ReinforcementFloor3DebugScene } from './ReinforcementFloor3DebugScene';
import { ReinforcementFloor4DebugScene } from './ReinforcementFloor4DebugScene';
import { ReinforcementFloor5DebugScene } from './ReinforcementFloor5DebugScene';

class ReinforcementBuildingBootstrapScene extends Phaser.Scene {
  constructor() { super('ReinforcementBuildingBootstrapScene'); }
  create() { this.scene.start('ReinforcementFloor1DebugScene', { buildingMode: true }); }
}

export function ReinforcementBuildingDebugApp() {
  const mount = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Floor 1 · Loading...');

  useEffect(() => {
    const ready = (floor: number, _spawn: string, lastTransition?: string) => setStatus(`Floor ${floor}${lastTransition ? ` · ${lastTransition}` : ''}`);
    const failed = (message: string) => setStatus(`ERROR: ${message}`);
    const windowFailed = (event: ErrorEvent) => failed(event.message);
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
      scene: [ReinforcementBuildingBootstrapScene, ReinforcementFloor1DebugScene, ReinforcementFloor2DebugScene, ReinforcementFloor3DebugScene, ReinforcementFloor4DebugScene, ReinforcementFloor5DebugScene],
    });
    const errorEvents = [1, 2, 3, 4, 5].map(floor => `reinforcement-floor${floor}-debug-error`);
    game.canvas.tabIndex = 0;
    game.canvas.setAttribute('aria-label', 'Reinforcement Building Debug canvas');
    game.canvas.focus();
    game.events.on('reinforcement-building-floor-ready', ready);
    for (const event of errorEvents) game.events.on(event, failed);
    window.addEventListener('error', windowFailed);
    return () => {
      window.removeEventListener('error', windowFailed);
      game.events.off('reinforcement-building-floor-ready', ready);
      for (const event of errorEvents) game.events.off(event, failed);
      game.destroy(true);
    };
  }, []);

  return <main className="stage" aria-label="Reinforcement Building Cross-Floor Debug Playtest">
    <div ref={mount} className="game" />
    <output data-testid="reinforcement-building-status" style={{ position: 'absolute', right: 8, bottom: 8, zIndex: 30, padding: '4px 7px', background: '#071018dd', font: '12px monospace' }}>{status}</output>
  </main>;
}
