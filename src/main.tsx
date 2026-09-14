import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as Phaser from 'phaser';
import { ScaleValidationScene, type Controls, type Stats } from './ScaleValidationScene';
import { HEIGHT_OPTIONS, LOGICAL, NPC_DENSITY_OPTIONS, STATIONS, TIGER_FOOTPRINT, ZOOM_OPTIONS } from './config';
import './style.css';
import { CorridorCapacityScene } from './CorridorCapacityScene';
import { CORRIDOR_CASES, type CorridorCase } from './corridorCapacity';
import { PlazaParkScene } from './PlazaParkScene';
import type { CharacterLabel } from './characterPool';
import type { ManualLabelingState } from './cctvManualLabeling';

const EMPTY_MANUAL_STATE:ManualLabelingState={cctvs:[],selectedCctv:null,visibleCharacterIds:[],selectedCharacter:null,manualLabeledDistinctCount:0,verifiedTrainingSampleCount:0,trainingReady:false};

function App() {
  const mount = useRef<HTMLDivElement>(null);
  const scene = useRef<ScaleValidationScene | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const capacityRef = useRef<CorridorCapacityScene | null>(null);
  const [corridor, setCorridor] = useState(false);
  const plazaRef = useRef<PlazaParkScene | null>(null);
  const [plaza, setPlaza] = useState(false);
  const [, setPlazaStats] = useState('Loading Plaza & Park...');
  const [, setSmokeStats] = useState('');
  const [manual,setManual]=useState<ManualLabelingState>(EMPTY_MANUAL_STATE);
  const [testCase, setTestCase] = useState<CorridorCase>('A');
  const [capacityStats, setCapacityStats] = useState('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [controls, setControls] = useState<Controls>({ zoom: 1, height: 80, density: 12, gameplay: false, debug: true, moving: true });
  const [stats, setStats] = useState<Stats>({ fps: 0, x: 640, y: 480, direction: 'down', selected: null, height: 80 });
  useEffect(() => {
    const validation = new ScaleValidationScene(setStats);
    scene.current = validation;
    const capacity = new CorridorCapacityScene(setCapacityStats);
    capacityRef.current = capacity;
    const plazaScene = new PlazaParkScene(setPlazaStats,setSmokeStats,setManual);
    plazaRef.current = plazaScene;
    const game = new Phaser.Game({
      type: Phaser.AUTO, parent: mount.current!, width: LOGICAL.width, height: LOGICAL.height,
      backgroundColor: '#263238', pixelArt: true, roundPixels: true,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [validation, capacity, plazaScene],
    });
    gameRef.current = game;
    const loaded = () => setReady(true);
    const failed = (event: ErrorEvent) => setError(event.message);
    game.events.once('validation-ready', loaded);
    window.addEventListener('error', failed);
    return () => {
      window.removeEventListener('error', failed);
      game.events.off('validation-ready', loaded);
      game.destroy(true);
      scene.current = null;
      gameRef.current = null;
    };
  }, []);
  useEffect(() => { if (ready) scene.current?.applyControls(controls); }, [controls, ready]);
  const change = (next: Partial<Controls>) => {
    setControls((old) => ({ ...old, ...next }));
    // Return movement input to the game after operating a native control.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };
  const toggleCorridor = () => {
    const manager = gameRef.current!.scene;
    if (!corridor) {
      manager.sleep('ScaleValidationScene');
      if (manager.isSleeping('CorridorCapacityScene')) manager.wake('CorridorCapacityScene');
      else manager.start('CorridorCapacityScene');
    } else { manager.sleep('CorridorCapacityScene'); manager.wake('ScaleValidationScene'); }
    setCorridor(!corridor);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };
  const togglePlaza = () => {
    const manager = gameRef.current!.scene;
    if (!plaza) {
      manager.sleep('ScaleValidationScene');
      if (manager.isSleeping('PlazaParkScene')) manager.wake('PlazaParkScene');
      else manager.start('PlazaParkScene');
    } else { manager.sleep('PlazaParkScene'); manager.wake('ScaleValidationScene'); }
    setPlaza(!plaza);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };
  const mapAction = (action: () => void) => {
    action();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };
  const labelSelected=(label:CharacterLabel)=>mapAction(()=>plazaRef.current?.setSelectedUserLabel(label));
  return <main className="stage">
    <div ref={mount} className="game" aria-label="ScaleValidationScene" />
    <header className="toolbar">
      <strong>Scale Validation</strong>
      {!plaza && <button disabled={!ready} onClick={toggleCorridor}>{corridor ? 'Back to Scale' : 'Corridor Tests'}</button>}
      {!corridor && <button disabled={!ready} onClick={togglePlaza}>{plaza ? 'Back to Scale' : 'Plaza & Park'}</button>}
      {plaza ? <>
        {manual.cctvs.map((name,index)=><button key={name} aria-pressed={manual.selectedCctv===name} onClick={()=>mapAction(()=>plazaRef.current?.selectCctv(name))}>CCTV {index+1}</button>)}
        <button onClick={()=>mapAction(()=>plazaRef.current?.toggleDebug())}>Map Debug</button>
      </> : corridor ? <>
        <label>Test <select aria-label="Corridor test" value={testCase} onChange={(e) => { const test = e.target.value as CorridorCase; setTestCase(test); capacityRef.current?.select(test); }}>{Object.entries(CORRIDOR_CASES).map(([key, value]) => <option value={key} key={key}>{key} · {value.label}</option>)}</select></label>
        <button onClick={() => capacityRef.current?.select(testCase)}>Restart test</button>
        <button onClick={() => capacityRef.current?.togglePause()}>Pause / Resume</button>
      </> : <>
      <label>Zoom <select aria-label="Camera zoom" value={controls.zoom} onChange={(e) => change({ zoom: Number(e.target.value) })}>{ZOOM_OPTIONS.map((n) => <option key={n}>{n}</option>)}</select></label>
      <label>Tiger <select aria-label="Tiger height" value={controls.height} onChange={(e) => change({ height: Number(e.target.value) })}>{HEIGHT_OPTIONS.map((n) => <option key={n}>{n}</option>)}</select></label>
      <label>NPC <select aria-label="NPC density" value={controls.density} onChange={(e) => change({ density: Number(e.target.value) })}>{NPC_DENSITY_OPTIONS.map((n) => <option key={n}>{n}</option>)}</select></label>
      <button onClick={() => change({ gameplay: !controls.gameplay })}>{controls.gameplay ? 'Full World' : 'Gameplay Layout'}</button>
      <button aria-pressed={controls.debug} onClick={() => change({ debug: !controls.debug })}>Debug {controls.debug ? 'ON' : 'OFF'}</button>
      <button onClick={() => change({ moving: !controls.moving })}>{controls.moving ? 'Pause NPC' : 'Move NPC'}</button>
      </>}
    </header>
    {plaza ? <aside className="manual-panel" data-testid="manual-labeling">
      <h1>{manual.selectedCctv??'CCTV'}</h1>
      <p>화면 안 NPC {manual.visibleCharacterIds.length}명</p>
      <p>수동 라벨 {manual.manualLabeledDistinctCount}/8<br />검증 표본 {manual.verifiedTrainingSampleCount}/8<br />학습 준비 {manual.trainingReady?'READY':'대기'}</p>
      {manual.selectedCharacter?<>
        <h2>{manual.selectedCharacter.id}</h2>
        <p>현재 행동: {manual.selectedCharacter.currentBehavior.semantic}</p>
        <p>현재 분류: {manual.selectedCharacter.userLabel==='CITIZEN'?'시민':manual.selectedCharacter.userLabel==='VILLAIN'?'악당':'미분류'}</p>
        <div className="label-buttons">
          <button aria-pressed={manual.selectedCharacter.userLabel==='CITIZEN'} onClick={()=>labelSelected('CITIZEN')}>시민</button>
          <button aria-pressed={manual.selectedCharacter.userLabel==='VILLAIN'} onClick={()=>labelSelected('VILLAIN')}>악당</button>
        </div>
      </>:<p>선택된 캐릭터 없음</p>}
    </aside> : corridor ? <><output className="corridor-stats" data-testid="corridor-stats">{capacityStats}</output><aside className="corridor-notes"><b>Capacity validation only</b><p>48px/s · blocked → 0.35s wait → side-step<br />Endpoint pause 0.6s → reverse</p><p>Yellow/red: footprint / blocked<br />Purple: architecture clearance<br />v / ^: direction</p><p>S: 56px / 18×12<br />M: 68px / 22×14<br />L: 80px / 26×16</p><p>Large clearance: existing values<br />C/D: same six mixed NPCs</p><p>Waiting includes endpoint pause.<br />Longest wait = forward blockage.<br />최종 통로 폭은 사용자 판단.</p></aside></> : <output className="stats" aria-live="off" data-testid="stats">
      {error ? `ERROR: ${error}` : ready ? 'Scene READY' : 'Loading...'} · FPS {stats.fps.toFixed(1)} · logical 960×540 · zoom {controls.zoom.toFixed(2)}<br />
      Tiger {stats.height.toFixed(0)}px · ({stats.x.toFixed(1)}, {stats.y.toFixed(1)}) · {stats.direction} · footprint {TIGER_FOOTPRINT.width}×{TIGER_FOOTPRINT.height}<br />
      NPC {controls.density} · {controls.gameplay ? 'Gameplay 75/25' : 'Full World'} · selected {stats.selected ?? '—'}
    </output>}
    {!plaza && !corridor && controls.gameplay && <aside className="panel"><h1>Gameplay Layout</h1><p>UI 공간 25%<br />World viewport 720×540</p><hr /><p>Placeholder panel</p><p>실제 게임 UI가 들어올 공간입니다.</p><p>NPC 선택: {stats.selected ?? '없음'}</p><p>밀도·겹침·이동 여유·선택 가독성을 비교하세요.</p><small>최종 Scale 승인 전<br />검증 전용 Scene</small></aside>}
    <footer style={{ display: (plaza || corridor) ? 'none' : undefined }}>
      <span>WASD / 방향키 이동 · NPC 클릭</span>
      {Object.keys(STATIONS).map((name) => <button disabled={!ready} key={name} onClick={(e) => { scene.current?.goTo(name as keyof typeof STATIONS); e.currentTarget.blur(); }}>{name}</button>)}
      <span>Debug: 노랑=발 · 보라=벽 여유 · 흰색=anchor · 빨강=object · 파랑=NPC</span>
    </footer>
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
