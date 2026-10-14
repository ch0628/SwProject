import { useEffect, useRef, useState } from 'react';
import * as Phaser from 'phaser';
import graph from '../../../../docs/modules/machine_learning/reinforcement/navigation/navigation_graph_v1_f5_v3.json';
import { LOGICAL } from '../../../config.ts';
import { episodeSeed, type ProfileName } from '../sim/learningEngine.ts';
import { ACTUAL_MAP_FILES, buildActualMapEnvironment } from '../sim/actualMapEnvironment.ts';
import { runActualMapProfile } from '../sim/actualMapSimulation.ts';
import { createRuntimeCommands } from './runtimeCommands.ts';
import { ReinforcementRuntimeScene } from './ReinforcementRuntimeScene.ts';

type RuntimeStatus = { floor: number; trace: string; simulationTime: number };

export function ReinforcementRuntimeDebugApp() {
  const mount = useRef<HTMLDivElement>(null);
  const game = useRef<Phaser.Game | null>(null);
  const initialSeed = Number(new URLSearchParams(window.location.search).get('seed')) || 2;
  const [profile, setProfile] = useState<ProfileName>('FAST');
  const [seed, setSeed] = useState(initialSeed);
  const [run, setRun] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [status, setStatus] = useState<RuntimeStatus>({ floor: 1, trace: 'Loading actual maps…', simulationTime: 0 });
  const [trace, setTrace] = useState<string[]>([]);
  const [expected, setExpected] = useState('PENDING');

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        const maps = await Promise.all(ACTUAL_MAP_FILES.map(async path => {
          const response = await fetch(`/${path.replace(/^public\//, '')}`);
          if (!response.ok) throw new Error(`Map load failed: ${path}`);
          return response.json();
        }));
        if (cancelled || !mount.current) return;
        const environment = buildActualMapEnvironment(maps, graph as Parameters<typeof buildActualMapEnvironment>[1]);
        const actualRun = runActualMapProfile(environment, profile, seed, 1, 1);
        const episode = actualRun.rounds[0].episodes[0];
        const commands = createRuntimeCommands(environment, episode, episodeSeed(seed, 1, 1));
        setExpected(episode.terminalReason);
        const scene = new ReinforcementRuntimeScene({ maps, commands });
        const instance = new Phaser.Game({
          type: Phaser.AUTO,
          parent: mount.current,
          width: LOGICAL.width,
          height: LOGICAL.height,
          backgroundColor: '#071018',
          pixelArt: true,
          roundPixels: true,
          physics: { default: 'arcade', arcade: { debug: false } },
          scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
          scene: [scene],
        });
        game.current = instance;
        const onStatus = (value: RuntimeStatus) => {
          setStatus(value);
          setTrace(previous => [...previous.slice(-8), `F${value.floor} ${value.trace}`]);
        };
        const onReady = () => setTrace(previous => [...previous, 'F1 START']);
        const onTerminal = (reason: string, simulationTime: number) => setStatus(current => ({ ...current, trace: `TERMINAL → ${reason}`, simulationTime }));
        const onError = (message: string) => setStatus(current => ({ ...current, trace: `ERROR: ${message}` }));
        instance.events.on('reinforcement-runtime-status', onStatus);
        instance.events.on('reinforcement-runtime-ready', onReady);
        instance.events.on('reinforcement-runtime-terminal', onTerminal);
        instance.events.on('reinforcement-runtime-error', onError);
        instance.events.emit('reinforcement-runtime-speed', speed);
      } catch (error) {
        setStatus(current => ({ ...current, trace: `ERROR: ${error instanceof Error ? error.message : String(error)}` }));
      }
    };
    setTrace([]);
    setPaused(false);
    void start();
    return () => {
      cancelled = true;
      game.current?.destroy(true);
      game.current = null;
    };
  }, [profile, run, seed]);

  const togglePause = () => {
    const value = !paused;
    setPaused(value);
    game.current?.events.emit('reinforcement-runtime-pause', value);
  };

  const changeSpeed = (value: number) => {
    setSpeed(value);
    game.current?.events.emit('reinforcement-runtime-speed', value);
  };

  const panelStyle = { position: 'absolute', zIndex: 40, background: '#071018e8', color: '#e5f6ff', font: '13px monospace', border: '1px solid #38bdf8', padding: 10 } as const;
  return <main className="stage" aria-label="Reinforcement Production Runtime Debug">
    <div ref={mount} className="game" />
    <section style={{ ...panelStyle, left: 8, top: 8, width: 330 }} aria-label="Runtime controls">
      <div style={{ marginBottom: 8 }}>PRODUCTION RUNTIME · SINGLE ROBOT</div>
      <label>Profile <select value={profile} onChange={event => setProfile(event.target.value as ProfileName)}><option>SAFE</option><option>FAST</option></select></label>{' '}
      <label>Seed <input type="number" value={seed} onChange={event => setSeed(Number(event.target.value) || 1)} style={{ width: 72 }} /></label>
      <div style={{ marginTop: 8 }}>
        <button type="button" onClick={() => setRun(value => value + 1)}>Restart</button>{' '}
        <button type="button" onClick={togglePause}>{paused ? 'Resume' : 'Pause'}</button>{' '}
        {[1, 2, 4].map(value => <button key={value} type="button" disabled={speed === value} onClick={() => changeSpeed(value)}>{value}x</button>)}
      </div>
      <div style={{ marginTop: 8 }}>Expected terminal: {expected}</div>
      <div>Simulation Time: {status.simulationTime.toFixed(2)}</div>
    </section>
    <output style={{ ...panelStyle, right: 8, bottom: 8, width: 460 }} aria-live="polite">
      <div>Floor {status.floor} · {status.trace}</div>
      <div style={{ marginTop: 6, color: '#bae6fd' }}>{trace.map((line, index) => <div key={`${index}-${line}`}>{line}</div>)}</div>
    </output>
  </main>;
}

