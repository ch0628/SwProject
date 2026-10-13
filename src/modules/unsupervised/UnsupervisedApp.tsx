// 비지도학습 화면 (1차 뼈대). sceneFlow 상태를 그대로 그리는 얇은 뷰이며, 진행 로직은 sceneFlow.ts에만 있다.
// 이 파일의 로컬 상태는 아직 확정되지 않은 특징 체크박스 선택(pending)뿐이다.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { PORTRAITS, SCENE8_ARI } from './assets';
import { CoordinatePlane } from './CoordinatePlane';
import { FEATURE_KEYS, summarizeCluster, type FeatureKey } from './sim/clusteringEngine';
import {
  PRD_SCENE,
  createInitialFlowState,
  currentLine,
  isBlurry,
  isDialogueDone,
  transition,
  type FlowEvent,
  type FlowState,
} from './sim/sceneFlow';
import type { DialogueLine } from './data/dialogue';
import { FEATURE_DEFINITIONS, featureLevel } from './data/features';
import { RESIDENTS, toClusterInput } from './data/residents';
import { SCENE_TITLE, SPECIES_NAME, clusterName } from './labels';
import './unsupervised.css';

const CLUSTER_INPUTS = RESIDENTS.map(toClusterInput);

export function UnsupervisedApp() {
  const [flow, setFlow] = useState<FlowState>(createInitialFlowState);
  const [pending, setPending] = useState<FeatureKey[]>([]);
  const dispatch = (event: FlowEvent) => {
    // 확정한 체크는 바로 비워 둔다. 특징 재선택으로 돌아오면 빈 상태에서 시작한다.
    if (event.type === 'SELECT_FEATURES') setPending([]);
    setFlow((state) => transition(state, event));
  };
  const done = isDialogueDone(flow);
  const step = flow.step;

  useEffect(() => {
    const onSpace = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      event.preventDefault();
      if (!event.repeat) setFlow((state) => transition(state, { type: 'NEXT_LINE' }));
    };
    window.addEventListener('keydown', onSpace, true);
    return () => window.removeEventListener('keydown', onSpace, true);
  }, []);

  const togglePending = (key: FeatureKey) => setPending((current) =>
    current.includes(key) ? current.filter((item) => item !== key) : current.length < 2 ? [...current, key] : current);

  const clusterIndex = (id: string | null) => flow.clusterResult?.clusters.findIndex((cluster) => cluster.id === id) ?? -1;
  const findCluster = (id: string | null) => flow.clusterResult?.clusters.find((cluster) => cluster.id === id) ?? null;
  const showPlane = flow.selectedFeatures !== null && step !== 'FEATURE_SELECT' && step !== 'COMPLETE';
  const planeClickable = done && (step === 'CLUSTER_REVIEW' || step === 'CLUE_COMPARE');
  const activeClusterId = step === 'CLUSTER_REVIEW' ? flow.inspectedClusterId : flow.selectedClusterId;
  const onClusterClick = (clusterId: string) =>
    dispatch(step === 'CLUSTER_REVIEW' ? { type: 'INSPECT_CLUSTER', clusterId } : { type: 'SELECT_CLUSTER', clusterId });

  return <main className={`stage unsup-stage scene-${PRD_SCENE[step]}`}>
    {step !== 'TITLE' && <header className="unsup-scene-title">SCENE {PRD_SCENE[step]} | {SCENE_TITLE[step]}</header>}
    {step === 'TITLE' && <TitleCard onStart={() => dispatch({ type: 'PROCEED' })} />}

    {step === 'INCIDENT' && <aside className="unsup-side"><CluePanel title="발견된 단서" /></aside>}
    {step === 'EXPLAIN' && <ExplainPanel />}
    {step === 'FEATURE_SELECT' && <>
      <FeatureCards pending={pending} onToggle={togglePending} />
      <aside className="unsup-side"><CluePanel title="사건 단서" /></aside>
    </>}

    {showPlane && <div className="unsup-plane-wrap">
      <CoordinatePlane pair={flow.selectedFeatures!} residents={RESIDENTS}
        points={flow.clusterResult?.points ?? null}
        clusters={step === 'PATTERN_FIND' ? null : flow.clusterResult?.clusters ?? null}
        blurry={isBlurry(flow)} clickable={planeClickable} activeClusterId={activeClusterId}
        clearedClusterIds={flow.clearedClusterIds} revealedVillainIds={step === 'INVESTIGATE' ? flow.revealedVillainIds : []}
        investigating={step === 'INVESTIGATE' || step === 'ORDINARY_RESULT'}
        onClusterClick={onClusterClick} />
    </div>}

    {step === 'PATTERN_FIND' && <aside className="unsup-side"><ResidentTable highlight={flow.selectedFeatures!} /></aside>}
    {(step === 'CLUSTER_REVIEW' || step === 'FEATURE_FEEDBACK') && <aside className="unsup-side">
      {flow.inspectedClusterId
        ? <ClusterSummary state={flow} clusterId={flow.inspectedClusterId} name={clusterName(clusterIndex(flow.inspectedClusterId))} />
        : <section className="unsup-panel"><h2>분류 결과</h2><p>무리를 눌러 특징을 확인해 보세요.</p></section>}
    </aside>}
    {step === 'CLUE_COMPARE' && <aside className="unsup-side">
      <CluePanel title="사건 단서" />
      {flow.selectedClusterId && <ClusterSummary state={flow} clusterId={flow.selectedClusterId} name={clusterName(clusterIndex(flow.selectedClusterId))} />}
    </aside>}
    {step === 'ORDINARY_RESULT' && <aside className="unsup-side"><section className="unsup-panel">
      <h2>조사 결과</h2>
      <p className="unsup-result">{clusterName(clusterIndex(flow.clearedClusterIds.at(-1)!))}는 평범한 주민이었어요.</p>
      <MemberList ids={findCluster(flow.clearedClusterIds.at(-1)!)!.memberIds} villains={[]} />
    </section></aside>}
    {step === 'INVESTIGATE' && <aside className="unsup-side"><section className="unsup-panel">
      <h2>조사 결과</h2>
      <p className="unsup-result is-alert">숨겨진 악당을 찾았어요!</p>
      <MemberList ids={findCluster(flow.selectedClusterId)!.memberIds} villains={flow.revealedVillainIds} />
    </section></aside>}
    {step === 'COMPLETE' && <>
      <VillageCrowd />
      <LearningPanel state={flow} />
    </>}

    {!flow.finished && step !== 'TITLE' && <DialogueBox line={currentLine(flow)!}>
      {!done
        ? <button type="button" onClick={() => dispatch({ type: 'NEXT_LINE' })}>다음</button>
        : <SceneActions flow={flow} pending={pending} dispatch={dispatch} />}
    </DialogueBox>}

    {flow.finished && <div className="overlay unsup-finish"><section className="unsup-panel" role="dialog" aria-label="완료">
      <h1>비지도학습 완료!</h1>
      <button type="button" className="unsup-primary" onClick={() => window.location.assign('/')}>첫 화면으로 돌아가기</button>
    </section></div>}
  </main>;
}

function SceneActions({ flow, pending, dispatch }: { flow: FlowState; pending: readonly FeatureKey[]; dispatch: (event: FlowEvent) => void }) {
  const primary = (label: string, event: FlowEvent, disabled = false) =>
    <button type="button" className="unsup-primary" disabled={disabled} onClick={() => dispatch(event)}>{label}</button>;
  switch (flow.step) {
    case 'INCIDENT': return primary('단서 확인 완료', { type: 'PROCEED' });
    case 'EXPLAIN': return primary('분석 시작', { type: 'PROCEED' });
    case 'FEATURE_SELECT': return <>
      <span className="unsup-count" aria-live="polite">{pending.length} / 2개 선택</span>
      {primary('특징 선택 완료', { type: 'SELECT_FEATURES', features: pending }, pending.length !== 2)}
    </>;
    case 'PATTERN_FIND': return flow.clusterResult ? primary('다음', { type: 'PROCEED' }) : primary('패턴 찾기', { type: 'FIND_PATTERNS' });
    case 'CLUSTER_REVIEW': return primary('군집 살펴보기', { type: 'PROCEED' });
    case 'FEATURE_FEEDBACK': return primary('특징 다시 고르기', { type: 'RESELECT_FEATURES' });
    case 'CLUE_COMPARE': return primary('조사하기', { type: 'INVESTIGATE' }, !flow.selectedClusterId);
    case 'ORDINARY_RESULT': return primary('다른 무리 고르기', { type: 'RESELECT_CLUSTER' });
    case 'INVESTIGATE': return primary('확인', { type: 'PROCEED' });
    case 'COMPLETE': return primary('완료', { type: 'PROCEED' });
  }
}

function DialogueBox({ line, children }: { line: DialogueLine; children: ReactNode }) {
  return <section className="unsup-dialogue" aria-live="polite">
    <div className="unsup-portrait"><img src={PORTRAITS[line.speaker]} alt="" /></div>
    <div className="unsup-dialogue-copy">
      <strong>{line.speaker}</strong>
      <p>{highlight(line.text, line.highlights ?? [])}</p>
    </div>
    <div className="unsup-actions">{children}</div>
  </section>;
}

function highlight(text: string, phrases: readonly string[]): ReactNode[] {
  if (!phrases.length) return [text];
  const pattern = new RegExp(`(${phrases.map((phrase) => phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`);
  return text.split(pattern).map((part, index) => phrases.includes(part) ? <em key={index} className="unsup-clue-text">{part}</em> : part);
}

function CluePanel({ title }: { title: string }) {
  return <section className="unsup-panel unsup-clues">
    <h2>{title}</h2>
    <p><span className="unsup-clue-tag">단서 1</span><em className="unsup-clue-text">고기를 먹은 흔적</em></p>
    <p><span className="unsup-clue-tag">단서 2</span><em className="unsup-clue-text">밤늦게 움직이는 모습</em></p>
  </section>;
}

function ExplainPanel() {
  return <section className="unsup-panel unsup-explain">
    <h2>비슷한 친구끼리 모으기</h2>
    <ol>
      <li><b>정답표 없이</b><span>누가 악당인지 등 정답표는 없어요.</span></li>
      <li><b>특징을 보고</b><span>주민들의 여러 특징을 살펴보고…</span></li>
      <li><b>비슷한 주민끼리 모으기</b><span>비슷한 특징을 가진 주민끼리 모을 수 있어요!</span></li>
    </ol>
    <div className="unsup-silhouettes" aria-label="아직 표시가 없는 주민들">{RESIDENTS.map((resident) => <span key={resident.id}>?</span>)}</div>
  </section>;
}

function FeatureCards({ pending, onToggle }: { pending: readonly FeatureKey[]; onToggle: (key: FeatureKey) => void }) {
  return <section className="unsup-features" aria-label="분석할 특징 선택">
    {FEATURE_KEYS.map((key) => {
      const definition = FEATURE_DEFINITIONS[key];
      const checked = pending.includes(key);
      return <button key={key} type="button" role="checkbox" aria-checked={checked} className={`unsup-feature${checked ? ' is-checked' : ''}`} onClick={() => onToggle(key)}>
        <span className="unsup-check" aria-hidden="true">{checked ? '✔' : ''}</span>
        <b>{definition.label}</b>
        <span>{definition.axis[0]} ↔ {definition.axis[1]}</span>
      </button>;
    })}
  </section>;
}

function ResidentTable({ highlight: pair }: { highlight: readonly FeatureKey[] }) {
  return <section className="unsup-panel unsup-residents">
    <h2>주민 정보</h2>
    <table>
      <thead><tr><th>주민</th>{FEATURE_KEYS.map((key) => <th key={key} className={pair.includes(key) ? 'is-selected' : ''}>{FEATURE_DEFINITIONS[key].label}</th>)}</tr></thead>
      <tbody>{RESIDENTS.map((resident) => <tr key={resident.id}>
        <td>{SPECIES_NAME[resident.species]}</td>
        {FEATURE_KEYS.map((key) => <td key={key} className={pair.includes(key) ? 'is-selected' : ''}>{featureLevel(key, resident.features[key]).label}</td>)}
      </tr>)}</tbody>
    </table>
  </section>;
}

function ClusterSummary({ state, clusterId, name }: { state: FlowState; clusterId: string; name: string }) {
  const cluster = state.clusterResult!.clusters.find((candidate) => candidate.id === clusterId)!;
  const summary = summarizeCluster(cluster, CLUSTER_INPUTS, (key, value) => featureLevel(key, value).label);
  return <section className="unsup-panel unsup-summary">
    <h2>{name}의 특징</h2>
    <dl>{FEATURE_KEYS.map((key) => <div key={key} className={state.selectedFeatures?.includes(key) ? 'is-selected' : ''}>
      <dt>{FEATURE_DEFINITIONS[key].label}</dt><dd>{summary[key] === 'MIXED' ? '다양함' : summary[key]}</dd>
    </div>)}</dl>
    <MemberList ids={cluster.memberIds} villains={[]} />
  </section>;
}

function MemberList({ ids, villains }: { ids: readonly string[]; villains: readonly string[] }) {
  return <ul className="unsup-members">{ids.map((id) => {
    const resident = RESIDENTS.find((candidate) => candidate.id === id)!;
    const villain = villains.includes(id);
    return <li key={id} className={villain ? 'is-villain' : ''}>{SPECIES_NAME[resident.species]}{villains.length > 0 && (villain ? ' — 악당!' : ' — 주민')}</li>;
  })}</ul>;
}

/** PRD 2.2.1 제목·부제목. 지도학습 시작 오버레이(제목 + 문구 + 시작 버튼)와 같은 구성. */
function TitleCard({ onStart }: { onStart: () => void }) {
  return <div className="unsup-title-card" role="dialog" aria-labelledby="unsup-title">
    <section className="unsup-panel">
      <p className="unsup-subtitle">머신러닝(비지도학습) - AI가 학습하는 방법</p>
      <h1 id="unsup-title">수상한 무리를 찾아라!</h1>
      <button type="button" className="unsup-primary" onClick={onStart}>시작</button>
    </section>
  </div>;
}

/** Scene 8: 밝아진 마을에 아리와 주민들이 등장한다. PRD 이미지 기준으로 붙잡힌 악당은 제외한다. */
function VillageCrowd() {
  const citizens = RESIDENTS.filter((resident) => !resident.isVillain);
  return <section className="unsup-crowd" aria-label="아리와 마을 주민들">
    <figure className="unsup-crowd-ari"><img src={SCENE8_ARI} alt="" /><figcaption>아리</figcaption></figure>
    {citizens.map((resident, index) => <figure key={resident.id} style={{ '--cheer-delay': `${(index % 4) * 120}ms` } as CSSProperties}>
      <img src={resident.sprite} alt="" /><figcaption>{SPECIES_NAME[resident.species]}</figcaption>
    </figure>)}
  </section>;
}

function LearningPanel({ state }: { state: FlowState }) {
  return <section className="unsup-panel unsup-learning">
    <h2>학습 내용</h2>
    <p className="unsup-learning-title">비지도학습</p>
    <ol><li>정답 없이</li><li>특징을 비교하고</li><li>비슷한 것끼리 묶기</li></ol>
    {state.clusterResult && state.selectedFeatures && <div className="unsup-learning-plane">
      <CoordinatePlane compact pair={state.selectedFeatures} residents={RESIDENTS}
        points={state.clusterResult.points} clusters={state.clusterResult.clusters}
        blurry={false} clickable={false} activeClusterId={state.selectedClusterId}
        clearedClusterIds={[]} revealedVillainIds={state.revealedVillainIds} investigating={false}
        onClusterClick={() => {}} />
    </div>}
  </section>;
}
