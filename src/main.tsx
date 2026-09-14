import { useEffect, useRef, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import * as Phaser from 'phaser';
import { ScaleValidationScene, type Controls, type Stats } from './ScaleValidationScene';
import { HEIGHT_OPTIONS, LOGICAL, NPC_DENSITY_OPTIONS, STATIONS, TIGER_FOOTPRINT, ZOOM_OPTIONS } from './config';
import './style.css';
import { CorridorCapacityScene } from './CorridorCapacityScene';
import { CORRIDOR_CASES, type CorridorCase } from './corridorCapacity';
import { PlazaParkScene } from './PlazaParkScene';
import type { CharacterId, CharacterLabel, BehaviorHistoryEntry } from './characterPool';
import type { ManualLabelingState } from './cctvManualLabeling';
import {
  createGameFlow, startFirstTraining, completeFirstTraining,
  openTrackingReview, closeTrackingReview, canStartRetraining, startRetraining,
  completeRetraining, canStartFinalScan, startFinalScan, completeFinalScan,
  recordMonitoringVerification,
  type GameFlowState, type SupervisedGameState, type TrackingReviewContext,
} from './supervisedGameFlow';
import { MONITORING_TARGET_IDS, round2ComparisonFor, type Round2TargetStatus } from './plazaRound2';

const EMPTY_MANUAL_STATE: ManualLabelingState = { cctvs: [], selectedCctv: null, visibleCharacterIds: [], selectedCharacter: null, manualLabeledDistinctCount: 0, verifiedTrainingSampleCount: 0, trainingReady: false };
const TARGET_STATUS_LABEL: Record<Round2TargetStatus, string> = {
  WAITING: '판단해보기', COMPARISON_COMPLETE: '비교 완료', TRACKING_REQUIRED: '다시 확인하기', VERIFIED: '확인 완료',
};

type AriGuideStep =
  | 'START'
  | 'ROUND1_INTRO'
  | 'FIRST_TRAINING_INTRO'
  | 'ROUND2_INTRO'
  | 'RETRAINING_INTRO'
  | 'AI_ASSISTED_INTRO'
  | 'FINAL_SCAN_INTRO'
  | 'CITY_WIDE_RESULT'
  | 'FINAL_ARI'
  | 'COMPLETE'
  | null;

const AriGuideOverlay = ({ title, lines, cta, onNext }: { title?: string, lines: string[], cta: string, onNext: () => void }) => {
  const [page, setPage] = useState(0);
  const isLast = page >= lines.length - 1;
  return (
    <div className="overlay ari-guide-overlay" role="dialog">
      <div className="ari-container">
        <img src="/assets/ai/fairy.png" className="ari-img" alt="Ari 가이드" />
      </div>
      <div className="ari-speech-panel">
        {title && <h1 className="noto-font" style={{ fontSize: '2.5cqw', margin: '0 0 1.5cqw', color: '#e0f7fa' }}>{title}</h1>}
        <p className="ari-speech-text ari-font">
          {lines[page].split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}
        </p>
        <button className="btn-ari-next noto-font" onClick={() => isLast ? onNext() : setPage(p => p + 1)}>
          {isLast ? cta : '다음'}
        </button>
      </div>
    </div>
  );
};

const ZONE_MAPPING: Record<string, string> = {
  'PLAZA': '광장',
  'SHOPPING': '상가',
  'RESIDENTIAL': '거주지',
  'OFFSCREEN': 'CCTV 밖'
};

const SEMANTIC_MAPPING: Record<string, string> = {
  'ENTERING': '화면에 들어왔어요',
  'WALKING': '길을 걷고 있었어요',
  'RESTING': '쉬고 있었어요',
  'VISITING_FACILITY': '시설에 방문했어요',
  'RETURNING_HOME': '집으로 돌아갔어요',
  'VANDALIZING': '시설물을 훼손했어요',
  'ESCAPING': '도망가고 있었어요',
  'VISITING_CAFE': '카페에 방문했어요',
  'THREATENING': '다른 친구를 위협했어요',
  'JOGGING': '조깅을 하고 있었어요',
  'TRANSITING': '길을 이동하고 있었어요',
  'TALKING': '다른 친구와 이야기했어요',
  'SNATCHING': '물건을 낚아챘어요',
  'CAFE_SERVICE': '카페 일을 하고 있었어요',
  'REPAIRING': '시설을 고치고 있었어요',
  'MANHOLE_TAMPER': '맨홀을 함부로 건드렸어요',
  'STEALING': '물건을 훔치려 했어요',
  'EXERCISING': '운동하고 있었어요',
  'RUNNING': '빠르게 뛰어갔어요',
  'IDLING': '주변에 머물러 있었어요',
  'CARRYING_TOOLS': '도구를 들고 있었어요',
  'WAITING': '기다리고 있었어요',
  'LOOKING_AROUND': '주변을 두리번거렸어요',
  'DELIVERING': '물건을 전달하고 있었어요',
  'COMMUTING': '길을 이동하고 있었어요'
};

const PRIMITIVE_MAPPING: Record<string, string> = {
  'ENTER': 'CCTV 화면에 들어왔어요',
  'EXIT': 'CCTV 화면 밖으로 나갔어요',
  'WALK': '길을 걸어갔어요',
  'RUN': '빠르게 뛰어갔어요',
  'TALK': '다른 친구와 이야기했어요',
  'REST': '잠시 쉬었어요',
  'IDLE': '주변에 머물러 있었어요',
  'INTERACT': '주변 사물을 만졌어요',
  'SUSPICIOUS_ACTION': '수상한 행동을 했어요'
};

function formatBehavior(entry: BehaviorHistoryEntry): string {
  if (entry.behavior.semantic && SEMANTIC_MAPPING[entry.behavior.semantic]) {
    return SEMANTIC_MAPPING[entry.behavior.semantic];
  }
  return PRIMITIVE_MAPPING[entry.behavior.primitive] || entry.behavior.primitive;
}


function App() {
  const mount = useRef<HTMLDivElement>(null);
  const scene = useRef<ScaleValidationScene | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const capacityRef = useRef<CorridorCapacityScene | null>(null);
  const [corridor, setCorridor] = useState(false);
  const plazaRef = useRef<PlazaParkScene | null>(null);

  const searchParams = new URLSearchParams(window.location.search);
  const debugMode = searchParams.get('debug') === '1' || searchParams.get('mode') === 'dev';

  const [plaza, setPlaza] = useState(!debugMode);
  const [, setPlazaStats] = useState('Loading Plaza & Park...');
  const [, setSmokeStats] = useState('');
  const [manual, setManual] = useState<ManualLabelingState>(EMPTY_MANUAL_STATE);
  const [testCase, setTestCase] = useState<CorridorCase>('A');
  const [capacityStats, setCapacityStats] = useState('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [controls, setControls] = useState<Controls>({ zoom: 1, height: 80, density: 12, gameplay: false, debug: debugMode, moving: true });
  const [stats, setStats] = useState<Stats>({ fps: 0, x: 640, y: 480, direction: 'down', selected: null, height: 80 });

  // Supervised learning game flow state
  const [flow, setFlow] = useState<GameFlowState>(createGameFlow);
  const [guideStep, setGuideStep] = useState<AriGuideStep>(debugMode ? null : 'START');
  const [trackingHistory, setTrackingHistory] = useState<readonly BehaviorHistoryEntry[]>([]);

  useEffect(() => {
    const validation = new ScaleValidationScene(setStats);
    scene.current = validation;
    const capacity = new CorridorCapacityScene(setCapacityStats);
    capacityRef.current = capacity;
    const plazaScene = new PlazaParkScene(setPlazaStats, setSmokeStats, setManual);
    plazaRef.current = plazaScene;
    const game = new Phaser.Game({
      type: Phaser.AUTO, parent: mount.current!, width: LOGICAL.width, height: LOGICAL.height,
      backgroundColor: '#263238', pixelArt: true, roundPixels: true,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [validation, capacity, plazaScene],
    });
    gameRef.current = game;
    const loaded = () => {
      setReady(true);
      if (!debugMode) {
        const manager = game.scene;
        manager.sleep('ScaleValidationScene');
        manager.start('PlazaParkScene', { mapVersion: 'v2' });
      }
    };
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
  }, [debugMode]);

  useEffect(() => { if (ready) scene.current?.applyControls(controls); }, [controls, ready]);
  const change = (next: Partial<Controls>) => {
    setControls((old) => ({ ...old, ...next }));
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
      else manager.start('PlazaParkScene', { mapVersion: 'v2' });
    } else { manager.sleep('PlazaParkScene'); manager.wake('ScaleValidationScene'); }
    setPlaza(!plaza);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };
  const mapAction = (action: () => void) => {
    action();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };
  const labelSelected = (label: CharacterLabel) => mapAction(() => {
    plazaRef.current?.setSelectedUserLabel(label);
  });

  // ── Supervised flow actions ──────────────────────────────────────────
  const doVerify = useCallback(() => {
    const scene = plazaRef.current;
    if (!scene) return;

    // Allow verifying only the selected character if not in a specific tracking context
    const id = manual.selectedCharacter?.id || flow.trackingNpcId;
    if (!id) return;

    const monitoring = MONITORING_TARGET_IDS.includes(id as typeof MONITORING_TARGET_IDS[number]) &&
      scene.getCurrentRound() === 2 && scene.getAiLabel(id) !== null;
    const actualLabel = scene.verifyCharacter(id, monitoring);

    setFlow(f => {
      if (monitoring && actualLabel) recordMonitoringVerification(f, id);
      return { ...f };
    });
  }, [manual.selectedCharacter, flow.trackingNpcId, flow.trackingContext]);

  const doOpenTracking = useCallback((context: TrackingReviewContext) => {
    const scene = plazaRef.current;
    if (!scene || !manual.selectedCharacter) return;
    const history = scene.getBehaviorHistory(manual.selectedCharacter.id);
    setTrackingHistory(history);
    setFlow(f => { openTrackingReview(f, manual.selectedCharacter!.id, context); return { ...f }; });
  }, [manual.selectedCharacter]);

  const doCloseTracking = useCallback((returnPhase: SupervisedGameState) => {
    setFlow(f => { closeTrackingReview(f, returnPhase); return { ...f }; });
  }, []);

  const doStartFirstTraining = useCallback(() => {
    setFlow(f => { startFirstTraining(f, manual.verifiedTrainingSampleCount); return { ...f }; });
    // After brief animation completes, transition to Round 2
    setTimeout(() => {
      plazaRef.current?.applyRound2();
      setFlow(f => { completeFirstTraining(f); return { ...f }; });
      setGuideStep('ROUND2_INTRO');
    }, 4000);
  }, [manual.verifiedTrainingSampleCount]);

  const doStartRetraining = useCallback(() => {
    const state = plazaRef.current?.getRound2TrainingState();
    if (!state) return;
    setFlow(f => { startRetraining(f, state.aiWrongVerifiedCount); return { ...f }; });
    setTimeout(() => {
      plazaRef.current?.revealPostRetrainingLabels();
      setFlow(f => { completeRetraining(f); return { ...f }; });
      setGuideStep('AI_ASSISTED_INTRO');
    }, 4000);
  }, []);

  const doStartFinalScan = useCallback(() => {
    setFlow(f => { startFinalScan(f); return { ...f }; });
    setTimeout(() => {
      setFlow(f => { completeFinalScan(f); return { ...f }; });
      setGuideStep('CITY_WIDE_RESULT');
    }, 4000);
  }, []);

  const doCompare = useCallback((userGuess: CharacterLabel) => {
    const scene = plazaRef.current;
    if (!scene || !manual.selectedCharacter) return;
    const id = manual.selectedCharacter.id;
    scene.compareCharacter(id, userGuess);
    setFlow(f => ({ ...f }));
  }, [manual.selectedCharacter]);

  const isPlazaManual = plaza && flow.phase === 'MANUAL_LABELING';
  const isPlazaCompare = plaza && flow.phase === 'HUMAN_AI_COMPARE';
  const isPlazaMonitor = plaza && flow.phase === 'AI_ASSISTED_MONITORING';
  const r2State = plaza && flow.round === 2 ? plazaRef.current?.getRound2TrainingState() : null;
  const r2Targets = plazaRef.current?.getRound2TargetStatuses() ?? [];
  const trackingId = flow.trackingNpcId;
  const trackingVerified = trackingId ? plazaRef.current?.getVerifiedLabel(trackingId) : null;

  const focusCharacter = (id: string) => mapAction(() => {
    plazaRef.current?.focusCharacter(id as CharacterId);
  });

  return <main className="stage">
    <div ref={mount} className="game" aria-label="ScaleValidationScene" />

    {/* ── START screen ── */}
    {plaza && guideStep === 'START' && (
      <AriGuideOverlay
        title="AI CCTV를 도와줘!"
        lines={[
          "안녕! 나는 아리야!\n도시 CCTV의 AI가 고장 나서\n시민과 악당을 자꾸 헷갈리고 있어.\n네가 몇 명의 정답을 알려주면\nAI가 다시 배울 수 있대!"
        ]}
        cta="시작하기"
        onNext={() => setGuideStep('ROUND1_INTRO')}
      />
    )}

    {/* ── Ari Guides ── */}
    {plaza && guideStep === 'ROUND1_INTRO' && (
      <AriGuideOverlay title="마을 CCTV" lines={[
        "먼저 네가 직접 몇 명을 확인해줘!\n화면 속 친구를 눌러서\n시민인지 악당인지 골라보자.",
        "초록 체크는 시민,\n빨간 X는 악당으로 고른 표시야!\n\n확인한 정답이 8개 모이면\nAI가 그걸 보고 공부할 수 있어."
      ]} cta="알겠어!" onNext={() => setGuideStep(null)} />
    )}
    {plaza && guideStep === 'FIRST_TRAINING_INTRO' && (
      <AriGuideOverlay title="AI 첫 학습" lines={[
        "좋아! 정답이 충분히 모였어!\n이제 네가 확인한 정답을\n중앙 AI에게 알려주자.",
        "AI가 시민과 악당을\n구분하는 방법을 공부할 거야!"
      ]} cta="AI 공부시키기" onNext={() => { setGuideStep(null); doStartFirstTraining(); }} />
    )}
    {plaza && guideStep === 'ROUND2_INTRO' && (
      <AriGuideOverlay title="AI와 비교해보기" lines={[
        "AI가 첫 공부를 끝냈어!\n이제 처음 보는 친구도\nAI가 스스로 판단해볼 거야.",
        "노란 물음표가 있는 8명을\n너도 먼저 판단해봐!\n\n네 생각과 AI의 생각이 다르면\n추적 기록을 보고 정답을 확인해줘."
      ]} cta="알겠어!" onNext={() => setGuideStep(null)} />
    )}
    {plaza && guideStep === 'RETRAINING_INTRO' && (
      <AriGuideOverlay title="AI 다시 가르치기" lines={[
        "AI가 틀렸던 부분도 모두 찾았어!\n이 정답을 다시 알려주면\nAI가 같은 실수를 줄일 수 있을 거야."
      ]} cta="다시 알려주기" onNext={() => { setGuideStep(null); doStartRetraining(); }} />
    )}
    {plaza && guideStep === 'AI_ASSISTED_INTRO' && (
      <AriGuideOverlay title="AI 보조 모니터링" lines={[
        "이번에는 AI가 먼저\nCCTV 속 친구들을 살펴봤어!\n이제 네가 모든 친구를\n한 명씩 판단하지 않아도 돼.",
        "느낌표가 있는 세 친구만\n다시 확인해줘!\n\nAI 표시가 붙어 있으면\nAI가 먼저 판단했다는 뜻이야."
      ]} cta="확인하러 가기" onNext={() => setGuideStep(null)} />
    )}
    {plaza && guideStep === 'FINAL_SCAN_INTRO' && (
      <AriGuideOverlay title="최종 스캔" lines={[
        "이제 마지막이야!\nAI가 도시 전체 CCTV를\n한꺼번에 확인해볼 거야.",
        "많은 친구를 동시에\n판단하는 모습을 지켜보자!"
      ]} cta="도시 전체 확인하기" onNext={() => { setGuideStep(null); doStartFinalScan(); }} />
    )}
    {plaza && guideStep === 'FINAL_ARI' && (
      <AriGuideOverlay title="지도학습" lines={[
        "처음에는 네가 직접\n시민과 악당의 정답을 알려줬지?",
        "AI는 네가 알려준 정답을 보고 배우고,\n처음 보는 친구도 스스로 판단하기 시작했어.\n그리고 이제는 도시 전체 CCTV도\n한꺼번에 살펴볼 수 있게 됐어!",
        "이렇게 정답이 있는 예시를 알려주며\nAI를 가르치는 방법을\n'지도학습'이라고 해!"
      ]} cta="완료!" onNext={() => setGuideStep('COMPLETE')} />
    )}

    {/* ── CITY_WIDE_RESULT ── */}
    {plaza && guideStep === 'CITY_WIDE_RESULT' && (() => {
      const npcs = (plazaRef.current as any)?.round1?.npcs ?? [];
      const aiCit = npcs.filter((n: any) => n.character.labels.aiLabel === 'CITIZEN').length;
      const aiVil = npcs.filter((n: any) => n.character.labels.aiLabel === 'VILLAIN').length;
      return (
        <div className="overlay result-overlay dongle-font" role="dialog" aria-label="도시 전체 판별 결과">
          <div className="city-result-card">
            <h2>도시 전체 판별 완료!</h2>
            <div className="city-result-grid">
              {manual.cctvs.map((name, i) => (
                <div key={name} className="city-cctv-card">
                  <h3>CCTV {i + 1}</h3>
                  <div className="cctv-result-marks">
                    <span className="cctv-mark mark-cit">✓</span>
                    <span className="cctv-mark mark-vil">✕</span>
                    <span className="cctv-mark mark-cit">✓</span>
                    <span className="cctv-mark mark-cit">✓</span>
                    <span className="cctv-mark mark-vil">✕</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="city-result-summary">
              <span>AI가 시민으로 판단한 친구 <strong>{aiCit}</strong>명</span>
              <span>AI가 악당으로 판단한 친구 <strong>{aiVil}</strong>명</span>
            </div>
            <button className="btn-ari-next noto-font" onClick={() => setGuideStep('FINAL_ARI')} style={{ float: 'none', padding: '0.8cqw 3cqw', fontSize: '1.5cqw', borderRadius: '1cqw', background: '#37474f', border: 'none', color: '#fff' }}>아리 이야기 듣기</button>
          </div>
        </div>
      );
    })()}

    {/* ── FIRST_TRAINING overlay ── */}
    {plaza && flow.phase === 'FIRST_TRAINING' && (
      <div className="overlay training-overlay dongle-font" role="dialog" aria-label="AI 첫 번째 학습">
        <div className="training-card dongle-font" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h2 style={{ fontSize: '3cqw', marginBottom: '2cqw', color: '#b9f6ca' }}>AI가 네가 알려준 정답을 공부하고 있어!</h2>
          <div className="cutscene-container">
            <img src="/assets/ai/central_ai_core.png" className="ai-core-img training-pulse" alt="AI 코어" style={{ width: '15cqw', height: '15cqw', zIndex: 2, margin: 0 }} />
            <div className="data-packet citizen-packet">✓ 시민</div>
            <div className="data-packet villain-packet">✕ 악당</div>
          </div>
          <div className="progress-bar" style={{ width: '80%', marginTop: '3cqw' }}><div className="progress-fill training-fill" /></div>
        </div>
      </div>
    )}

    {/* ── RETRAINING overlay ── */}
    {plaza && flow.phase === 'RETRAINING' && (
      <div className="overlay training-overlay dongle-font" role="dialog" aria-label="AI 재학습">
        <div className="training-card dongle-font" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h2 style={{ fontSize: '3cqw', marginBottom: '2cqw', color: '#ffd54f' }}>AI가 틀린 부분을 다시 공부하고 있어!</h2>
          <div className="cutscene-container">
            <img src="/assets/ai/central_ai_core.png" className="ai-core-img training-pulse-fast" alt="AI 코어" style={{ width: '15cqw', height: '15cqw', zIndex: 2, margin: 0 }} />
            <div className="data-packet correction-packet">✓ 수정된 정답</div>
          </div>
          <div className="progress-bar" style={{ width: '80%', marginTop: '3cqw' }}><div className="progress-fill retraining-fill" /></div>
        </div>
      </div>
    )}

    {/* ── TRACKING_REVIEW overlay ── */}
    {plaza && flow.phase === 'TRACKING_REVIEW' && (
      <div className="overlay tracking-overlay dongle-font" role="dialog" aria-label="추적 기록">
        <div className="tracking-card dongle-font">
          <h2>📋 추적 기록 — {manual.selectedCharacter?.id ?? flow.trackingNpcId}</h2>
          
          {flow.trackingContext === 'COMPARE' && !trackingVerified && (
            <div className="tracking-explanation" style={{ background: '#3a1a1a', border: '1px solid #ef5350', padding: '1cqw', borderRadius: '0.8cqw', marginBottom: '1cqw' }}>
              <p style={{ margin: '0 0 0.5cqw', color: '#ffcdd2', fontSize: '1.4cqw', fontWeight: 'bold' }}>너와 AI의 생각이 달라!</p>
              <p style={{ margin: '0 0 0.5cqw', color: '#eceff1', fontSize: '1.2cqw' }}>추적 기록을 보고 실제로 어떤 행동을 했는지 확인해보자.</p>
              <p style={{ margin: 0, color: '#b0bec5', fontSize: '1.1cqw' }}>기록을 살펴봤다면 <strong>[정답 확인]</strong>을 눌러 이 친구의 정답을 확정해줘.</p>
            </div>
          )}

          <ul className="history-list">
            {trackingHistory.length === 0 && <li className="history-empty">기록 없음</li>}
            {trackingHistory.map((entry, i) => (
              <li key={i} className={`history-entry prim-${entry.behavior.primitive.toLowerCase()}`}>
                <span className="history-time">{entry.simulationTime.toFixed(1)}초</span>
                <span className="history-zone">{ZONE_MAPPING[entry.zone] ?? entry.zone}</span>
                <span className="history-behavior">{formatBehavior(entry)}</span>
              </li>
            ))}
          </ul>
          {trackingVerified && (
            <div className="verified-reveal">
              검증 완료 · 실제 <strong>{trackingVerified === 'VILLAIN' ? '악당' : '시민'}</strong>
            </div>
          )}
          <div className="tracking-actions">
            {(flow.trackingContext === 'COMPARE' || flow.trackingContext === 'MONITORING') && !trackingVerified && (
              <button className="btn-verify" onClick={doVerify}>
                정답 확인
              </button>
            )}
            <button className="btn-close" onClick={() => doCloseTracking(
              flow.trackingContext === 'VERIFICATION' ? 'MANUAL_LABELING' :
                flow.trackingContext === 'COMPARE' ? 'HUMAN_AI_COMPARE' : 'AI_ASSISTED_MONITORING'
            )}>닫기</button>
          </div>
        </div>
      </div>
    )}

    {/* ── FINAL_SCAN overlay ── */}
    {plaza && flow.phase === 'FINAL_SCAN' && (
      <div className="overlay scan-overlay dongle-font" role="dialog" aria-label="최종 스캔">
        <div className="scan-card dongle-font">
          <h2>🔍 최종 스캔</h2>
          <div className="scan-grid">
            {manual.cctvs.map((name, i) => (
              <div key={name} className="scan-cell">
                <span className="scan-label">CCTV {i + 1}</span>
                <div className="scan-line" />
              </div>
            ))}
          </div>
          <div className="scan-stats" style={{ textAlign: 'center', marginTop: '1rem', fontWeight: 'bold' }}>
            {(() => {
              const npcs = (plazaRef.current as any)?.round1?.npcs ?? [];
              const aiCit = npcs.filter((n: any) => n.character.labels.aiLabel === 'CITIZEN').length;
              const aiVil = npcs.filter((n: any) => n.character.labels.aiLabel === 'VILLAIN').length;
              return <p>AI 시민 {aiCit}명 / AI 악당 {aiVil}명 탐지 완료</p>;
            })()}
          </div>
          <p className="scan-status">스캔 중...</p>
        </div>
      </div>
    )}

    {/* ── COMPLETE screen ── */}
    {plaza && flow.phase === 'COMPLETE' && (
      <div className="overlay complete-overlay dongle-font" role="dialog" aria-label="학습 완료">
        <div className="complete-card dongle-font">
          <h2>🎉 지도학습 완료!</h2>
          <p>AI는 두 번의 학습을 통해 더 정확해졌습니다.</p>
          <ul className="complete-summary">
            <li>Round 1 학습 데이터: <strong>{flow.aiTraining.totalVerifiedData}건</strong></li>
            <li>Round 2 오류 수정: <strong>{flow.aiTraining.correctionData}건</strong></li>
            {(() => {
              const npcs = (plazaRef.current as any)?.round1?.npcs ?? [];
              if (npcs.length > 0) {
                const aiCit = npcs.filter((n: any) => n.character.labels.aiLabel === 'CITIZEN').length;
                const aiVil = npcs.filter((n: any) => n.character.labels.aiLabel === 'VILLAIN').length;
                return <li>최종 분류 결과: <strong>AI 시민 {aiCit}명 / AI 악당 {aiVil}명</strong></li>;
              }
              return null;
            })()}
          </ul>
          <p className="complete-message">여러분의 판단이 AI를 가르쳤습니다!</p>
        </div>
      </div>
    )}

    {/* ── Player Toolbar ── */}
    {plaza && guideStep !== 'START' && flow.phase !== 'FINAL_SCAN' && flow.phase !== 'COMPLETE' && (
      <header className="toolbar noto-font">
        <strong style={{ color: '#80cbc4' }}>마을 CCTV</strong>
        {manual.cctvs.map((name, index) => (
          <button key={name} aria-pressed={manual.selectedCctv === name} onClick={() => mapAction(() => plazaRef.current?.selectCctv(name))}>
            CCTV {index + 1}
          </button>
        ))}
      </header>
    )}

    {/* ── Developer Toolbar ── */}
    {debugMode && (
      <header className="toolbar" style={{ top: plaza && guideStep !== 'START' && flow.phase !== 'FINAL_SCAN' && flow.phase !== 'COMPLETE' ? '3.5cqw' : 0 }}>
        <strong>Dev Tools</strong>
        {!plaza && <button disabled={!ready} onClick={toggleCorridor}>{corridor ? 'Back to Scale' : 'Corridor Tests'}</button>}
        {!corridor && <button disabled={!ready} onClick={togglePlaza}>{plaza ? 'Back to Scale' : 'Plaza & Park'}</button>}
        {plaza ? (
          <button onClick={() => mapAction(() => plazaRef.current?.toggleDebug())}>Map Debug</button>
        ) : corridor ? <>
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
    )}
    {isPlazaManual ? <aside className="manual-panel noto-font" style={{ display: 'flex', flexDirection: 'column' }} data-testid="manual-labeling">
      <h1>{manual.selectedCctv?.replace('PLAZA_CAM_', '') ?? 'CCTV'} 구역 CCTV</h1>
      
      {!manual.selectedCharacter ? (
        <>
          <p className="phase-guidance">친구들을 눌러서<br/>시민인지 악당인지 확인해보자!</p>
          <p>화면 속 친구 {manual.visibleCharacterIds.length}명</p>
        </>
      ) : (
        <>
          <h2>{manual.selectedCharacter.id}</h2>
          
          <div className="action-card">
            <p>이 친구는 누구일까?</p>
            <div className="label-buttons">
              <button aria-pressed={manual.selectedCharacter.userLabel === 'CITIZEN'} onClick={() => labelSelected('CITIZEN')}>시민</button>
              <button aria-pressed={manual.selectedCharacter.userLabel === 'VILLAIN'} onClick={() => labelSelected('VILLAIN')}>악당</button>
            </div>
            
            {manual.selectedCharacter.userLabel ? (
              <div className="verified-reveal">
                확인 완료!<br/>이 친구는 {manual.selectedCharacter.userLabel === 'VILLAIN' ? '악당' : '시민'}이야.
              </div>
            ) : (
              <div className="tracking-hint" style={{ marginTop: '1.5cqw' }}>
                <p style={{ color: '#78909c', fontSize: '1.2cqw', marginBottom: '0.5cqw' }}>잘 모르겠다면<br/>추적 기록을 살펴봐도 좋아!</p>
                <button className="btn-tracking" onClick={() => doOpenTracking('VERIFICATION')}>
                  📋 추적 기록 보기
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <div className="progress-card" style={{ marginTop: 'auto', paddingTop: '2cqw', borderTop: '1px solid #374850' }}>
        <h3 style={{ fontSize: '1.5cqw', color: '#b9f6ca', margin: '0 0 0.5cqw' }}>확인한 정답 {manual.verifiedTrainingSampleCount} / 8</h3>
        {!manual.trainingReady && <p style={{ color: '#90a4ae', fontSize: '1.2cqw', margin: 0 }}>정답 8개가 모이면<br/>AI가 공부할 수 있어!</p>}
      </div>

      {manual.trainingReady && (
        <button className="btn-train" onClick={() => setGuideStep('FIRST_TRAINING_INTRO')} id="start-first-training">
          🧠 AI 학습 시작
        </button>
      )}
    </aside> : isPlazaCompare ? <aside className="manual-panel compare-panel noto-font" style={{ display: 'flex', flexDirection: 'column', padding: 0 }} data-testid="human-ai-compare">
      <div className="compare-scroll-area" style={{ padding: '9cqw 1.6cqw 1cqw', flex: 1, overflowY: 'auto' }}>
        <h1>AI와 같이 판단해보자!</h1>
        <p className="phase-guidance" style={{ whiteSpace: 'pre-wrap' }}>{(r2State?.comparedCount ?? 0) === 0
          ? '물음표 친구들을 눌러\n너와 AI의 생각을 비교해봐!'
          : (r2State?.comparedCount ?? 0) < 8
            ? `비교한 친구 ${r2State?.comparedCount ?? 0} / 8`
            : (r2State?.verifiedCount ?? 0) < 8
              ? `판단은 모두 끝났어!\n생각이 달랐던 친구 ${8 - (r2State?.verifiedCount ?? 0)}명을 더 확인해보자.`
              : '비교와 추적 확인이 모두 끝났어!'}</p>
              
        {canStartRetraining(flow, r2State || null) && (
          <button className="btn-train" onClick={() => setGuideStep('RETRAINING_INTRO')} id="start-retraining" style={{ marginTop: '0.5cqw', marginBottom: '1cqw' }}>AI 다시 가르치기</button>
        )}

        <div className="target-list" style={{ marginTop: '1.5cqw' }}>
          {r2Targets.map(target => <button key={target.characterId} className={`target-row status-${target.status.toLowerCase()}`} onClick={() => focusCharacter(target.characterId)}>
            <span>{target.characterId}</span><strong>{TARGET_STATUS_LABEL[target.status]}</strong>
          </button>)}
        </div>
      </div>
      
      <div className="sticky-interaction" style={{ position: 'sticky', bottom: 0, background: '#263640', padding: '1.5cqw 1.6cqw 2cqw', borderTop: '2px solid #374850', marginTop: 'auto', zIndex: 10 }}>
      {manual.selectedCharacter ? (() => {
        const comp = round2ComparisonFor(manual.selectedCharacter.id);
        const userLabel = manual.selectedCharacter.userLabel;
        const aiLabel = plazaRef.current?.getAiLabel(manual.selectedCharacter.id) ?? null;
        const actualLabel = plazaRef.current?.getVerifiedLabel(manual.selectedCharacter.id) ?? null;
        const showed = userLabel !== null && aiLabel !== null;
        return <>
          <h2 className="selected-target" style={{ margin: '0 0 1cqw' }}>{manual.selectedCharacter.id}</h2>
          {comp && <div className="label-buttons" style={{ marginTop: 0 }}>
            <button aria-pressed={userLabel === 'CITIZEN'} disabled={showed} onClick={() => doCompare('CITIZEN')}>시민</button>
            <button aria-pressed={userLabel === 'VILLAIN'} disabled={showed} onClick={() => doCompare('VILLAIN')}>악당</button>
          </div>}
          {showed && comp && (
            <div className={`ai-result ${aiLabel === userLabel ? 'ai-agree' : 'ai-disagree'}`}>
              <span>내 생각: <strong>{userLabel === 'VILLAIN' ? '악당' : '시민'}</strong></span>
              <span>AI 생각: <strong>{aiLabel === 'VILLAIN' ? '악당' : '시민'}</strong></span>
              
              {aiLabel !== userLabel && !actualLabel && (
                <div style={{ marginTop: '0.8cqw' }}>
                  <p style={{ color: '#ffcdd2', fontWeight: 'bold', margin: '0 0 0.5cqw' }}>너와 AI의 생각이 달라!</p>
                  <button className="btn-tracking" onClick={() => doOpenTracking('COMPARE')} style={{ width: '100%' }}>📋 추적 기록 보기</button>
                </div>
              )}
              {aiLabel === userLabel && !actualLabel && (
                <p style={{ color: '#a5d6a7', fontWeight: 'bold', margin: '0.8cqw 0 0' }}>너와 AI의 생각이 같아!</p>
              )}
              {actualLabel && <span style={{ marginTop: '0.5cqw' }}>실제 정답: <strong>{actualLabel === 'VILLAIN' ? '악당' : '시민'}</strong></span>}
            </div>
          )}
          {comp && !showed && <p className="compare-hint">이 친구는 누구일까?</p>}
          {!comp && <p className="compare-hint">위 목록에서 친구를 골라봐!</p>}
        </>;
      })() : <p style={{ margin: 0 }}>목록에서 친구를 선택해봐!</p>}
      </div>
    </aside> : isPlazaMonitor ? <aside className="manual-panel monitor-panel noto-font" data-testid="ai-assisted-monitoring">
      <h1>이번엔 AI가 먼저 찾아봤어!</h1>
      <p className="phase-guidance">AI가 다시 확인해야 한다고 표시한<br/>세 친구만 살펴보자.<br/><br/><strong style={{ color: '#ffb74d' }}>느낌표 친구 3명만 확인하면 돼!</strong></p>
      <div className="target-list monitor-target-list">
        {MONITORING_TARGET_IDS.map(id => {
          const done = flow.aiMonitorVerifiedIds.includes(id);
          return <button key={id} className={`target-row ${done ? 'status-verified' : 'status-waiting'}`} onClick={() => focusCharacter(id)}>
            <span>{id}</span><strong>{done ? '확인 완료' : '확인하기'}</strong>
          </button>;
        })}
      </div>
      <p className="monitor-progress">확인한 친구 {flow.aiMonitorVerifiedIds.length} / 3</p>
      {manual.selectedCharacter ? (() => {
        const id = manual.selectedCharacter.id;
        const aiLabel = plazaRef.current?.getAiLabel(id);
        const isTarget = MONITORING_TARGET_IDS.includes(id as typeof MONITORING_TARGET_IDS[number]);
        return <>
          <h2>{id}</h2>
          {aiLabel && <p>AI 생각: <strong>{aiLabel === 'VILLAIN' ? '악당' : '시민'}</strong></p>}
          {isTarget ? <button className="btn-tracking" onClick={() => doOpenTracking('MONITORING')}>📋 추적 기록 보기</button>
            : <p className="compare-hint">목록에 있는 친구가 아니야.</p>}
        </>;
      })() : <p>위 대상의 확인하기를 누르세요.</p>}
      {canStartFinalScan(flow) && (
        <button className="btn-train" onClick={() => setGuideStep('FINAL_SCAN_INTRO')} id="start-final-scan">🔍 최종 스캔</button>
      )}
    </aside> : plaza ? <aside className="manual-panel noto-font" data-testid="manual-labeling">
      <h1>{manual.selectedCctv ?? 'CCTV'}</h1>
      <p>화면 안 NPC {manual.visibleCharacterIds.length}명</p>
      <p>수동 라벨 {manual.manualLabeledDistinctCount}/8<br />검증 표본 {manual.verifiedTrainingSampleCount}/8<br />학습 준비 {manual.trainingReady ? 'READY' : '대기'}</p>
      {manual.selectedCharacter ? <>
        <h2>{manual.selectedCharacter.id}</h2>
        <p>현재 분류: {manual.selectedCharacter.userLabel === 'CITIZEN' ? '시민' : manual.selectedCharacter.userLabel === 'VILLAIN' ? '악당' : '미분류'}</p>
        <div className="label-buttons">
          <button aria-pressed={manual.selectedCharacter.userLabel === 'CITIZEN'} onClick={() => labelSelected('CITIZEN')}>시민</button>
          <button aria-pressed={manual.selectedCharacter.userLabel === 'VILLAIN'} onClick={() => labelSelected('VILLAIN')}>악당</button>
        </div>
      </> : <p>선택된 캐릭터 없음</p>}
    </aside> : corridor ? <><output className="corridor-stats" data-testid="corridor-stats">{capacityStats}</output><aside className="corridor-notes"><b>Capacity validation only</b><p>48px/s · blocked → 0.35s wait → side-step<br />Endpoint pause 0.6s → reverse</p><p>Yellow/red: footprint / blocked<br />Purple: architecture clearance<br />v / ^: direction</p><p>S: 56px / 18×12<br />M: 68px / 22×14<br />L: 80px / 26×16</p><p>Large clearance: existing values<br />C/D: same six mixed NPCs</p><p>Waiting includes endpoint pause.<br />Longest wait = forward blockage.<br />최종 통로 폭은 사용자 판단.</p></aside></> : <output className="stats" aria-live="off" data-testid="stats">
      {error ? `ERROR: ${error}` : ready ? 'Scene READY' : 'Loading...'} · FPS {stats.fps.toFixed(1)} · logical 960×540 · zoom {controls.zoom.toFixed(2)}<br />
      Tiger {stats.height.toFixed(0)}px · ({stats.x.toFixed(1)}, {stats.y.toFixed(1)}) · {stats.direction} · footprint {TIGER_FOOTPRINT.width}×{TIGER_FOOTPRINT.height}<br />
      NPC {controls.density} · {controls.gameplay ? 'Gameplay 75/25' : 'Full World'} · selected {stats.selected ?? '—'}
    </output>}
    {!plaza && !corridor && controls.gameplay && debugMode && <aside className="panel"><h1>Gameplay Layout</h1><p>UI 공간 25%<br />World viewport 720×540</p><hr /><p>Placeholder panel</p><p>실제 게임 UI가 들어올 공간입니다.</p><p>NPC 선택: {stats.selected ?? '없음'}</p><p>밀도·겹침·이동 여유·선택 가독성을 비교하세요.</p><small>최종 Scale 승인 전<br />검증 전용 Scene</small></aside>}
    {debugMode && (
      <footer style={{ display: (plaza || corridor) ? 'none' : undefined }}>
        <span>WASD / 방향키 이동 · NPC 클릭</span>
        {Object.keys(STATIONS).map((name) => <button disabled={!ready} key={name} onClick={(e) => { scene.current?.goTo(name as keyof typeof STATIONS); e.currentTarget.blur(); }}>{name}</button>)}
        <span>Debug: 노랑=발 · 보라=벽 여유 · 흰색=anchor · 빨강=object · 파랑=NPC</span>
      </footer>
    )}
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
