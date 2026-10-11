// Scene 4~7 좌표평면 (1차: DOM, Phaser 없음). 상태를 받아 그리기만 한다.
// 표시 위치는 layout.ts로 겹침만 피하도록 조금 밀어낸 값이며, 실제 특징값과 군집 결과는 그대로다.
import type { CSSProperties } from 'react';
import type { Cluster, FeaturePair, ProjectedPoint, ResidentId } from './sim/clusteringEngine';
import { FEATURE_DEFINITIONS } from './data/features';
import type { ResidentDefinition } from './data/residents';
import { PLANE_SPREAD_OPTIONS, spreadPoints, startPosition } from './layout';
import { SPECIES_NAME, clusterName } from './labels';

const PAD = 8;
const SPAN = 100 - PAD * 2;
const CLUSTER_PAD = 0.07;
/** 스프라이트는 발 위치(좌표) 위로 그려지므로 테두리 위쪽을 더 넓힌다 */
const CLUSTER_PAD_TOP = 0.15;
const EDGE = 0.08;
const left = (x: number) => PAD + x * SPAN;
const top = (y: number) => PAD + (1 - y) * SPAN;

type Props = {
  pair: FeaturePair;
  residents: readonly ResidentDefinition[];
  /** null이면 [패턴 찾기] 전: 주민이 대기 위치에 서 있다 */
  points: readonly ProjectedPoint[] | null;
  clusters: readonly Cluster[] | null;
  blurry: boolean;
  clickable: boolean;
  activeClusterId: string | null;
  clearedClusterIds: readonly string[];
  revealedVillainIds: readonly ResidentId[];
  /** Scene 6 조사 결과 / Scene 7: 선택한 무리를 강조한다 */
  investigating: boolean;
  onClusterClick: (clusterId: string) => void;
};

export function CoordinatePlane(props: Props) {
  const { pair, residents, points, clusters, blurry, clickable, activeClusterId, clearedClusterIds, revealedVillainIds, investigating, onClusterClick } = props;
  const [xKey, yKey] = pair;
  const xDef = FEATURE_DEFINITIONS[xKey];
  const yDef = FEATURE_DEFINITIONS[yKey];
  const display = points ? spreadPoints(points, PLANE_SPREAD_OPTIONS) : null;
  const clusterOf = new Map(clusters?.flatMap((cluster) => cluster.memberIds.map((id) => [id, cluster.id] as const)) ?? []);
  const boxes = (clusters ?? []).map((cluster, index) => {
    const members = cluster.memberIds.map((id) => display!.get(id)!);
    const minX = Math.max(-EDGE, Math.min(...members.map((p) => p.x)) - CLUSTER_PAD);
    const maxX = Math.min(1 + EDGE, Math.max(...members.map((p) => p.x)) + CLUSTER_PAD);
    const minY = Math.max(-EDGE, Math.min(...members.map((p) => p.y)) - CLUSTER_PAD);
    const maxY = Math.min(1 + EDGE, Math.max(...members.map((p) => p.y)) + CLUSTER_PAD_TOP);
    const box = { left: `${left(minX)}%`, top: `${top(maxY)}%`, width: `${(maxX - minX) * SPAN}%`, height: `${(maxY - minY) * SPAN}%` };
    return { cluster, index, box, cleared: clearedClusterIds.includes(cluster.id) };
  });
  const activeBox = boxes.find(({ cluster }) => cluster.id === activeClusterId)?.box;
  const selectResident = (id: string) => {
    const clusterId = clusterOf.get(id as ResidentId);
    if (clickable && clusterId && !clearedClusterIds.includes(clusterId)) onClusterClick(clusterId);
  };

  const planeClass = ['unsup-plane', blurry ? 'is-blurry' : '', investigating ? 'is-investigating' : ''].join(' ');
  return <section className={planeClass} aria-label={`좌표평면: 가로 ${xDef.label}, 세로 ${yDef.label}`}>
    <div className="unsup-axis unsup-axis-x" />
    <div className="unsup-axis unsup-axis-y" />
    <span className="unsup-axis-name unsup-axis-name-x">{xDef.label}</span>
    <span className="unsup-axis-name unsup-axis-name-y">{yDef.label}</span>
    <span className="unsup-axis-end" style={{ left: '1%', top: '51%' }}>{xDef.axis[0]}</span>
    <span className="unsup-axis-end" style={{ right: '1%', top: '51%' }}>{xDef.axis[1]}</span>
    {xDef.levels.length === 3 && <span className="unsup-axis-end" style={{ left: '51%', top: '51%' }}>{xDef.levels[1].label}</span>}
    <span className="unsup-axis-end" style={{ left: '51%', bottom: '1%' }}>{yDef.axis[0]}</span>
    <span className="unsup-axis-end" style={{ left: '51%', top: '1%' }}>{yDef.axis[1]}</span>
    {yDef.levels.length === 3 && <span className="unsup-axis-end" style={{ left: '40%', top: '42%' }}>{yDef.levels[1].label}</span>}

    {boxes.map(({ cluster, index, box, cleared }) => {
      const classes = ['unsup-cluster', `tone-${index % 5}`, cluster.id === activeClusterId ? 'is-active' : '', cleared ? 'is-cleared' : ''].join(' ');
      return <button key={cluster.id} type="button" className={classes} disabled={!clickable || cleared} style={box}
        aria-label={`${clusterName(index)}${cleared ? ' (평범한 주민)' : ''}`} aria-pressed={cluster.id === activeClusterId}
        onClick={() => onClusterClick(cluster.id)} />;
    })}

    {residents.map((resident, index) => {
      const position = display?.get(resident.id) ?? startPosition(index);
      const revealed = revealedVillainIds.includes(resident.id);
      const inActive = activeClusterId !== null && clusterOf.get(resident.id) === activeClusterId;
      const classes = ['unsup-resident', display ? 'is-placed' : '', revealed ? 'is-villain' : '', inActive ? 'in-active' : '', inActive || revealed ? 'is-labeled' : ''].join(' ');
      const style = { left: `${left(position.x)}%`, top: `${top(position.y)}%`, '--move-delay': `${index * 90}ms` } as CSSProperties;
      return <figure key={resident.id} className={classes} style={style} onClick={() => selectResident(resident.id)}>
        <img src={revealed && resident.revealSprite ? resident.revealSprite : resident.sprite} alt="" />
        <figcaption>{SPECIES_NAME[resident.species]}{revealed ? ' · 악당' : ''}</figcaption>
      </figure>;
    })}

    {/* 이름표는 주민 스프라이트에 가려지지 않도록 마지막에 그린다 */}
    {boxes.map(({ cluster, index, box, cleared }) =>
      <span key={cluster.id} className={`unsup-cluster-name${cleared ? ' is-cleared' : ''}`} style={{ left: `calc(${box.left} + ${box.width} / 2)`, top: `max(${box.top}, 6%)` }} aria-hidden="true">
        {clusterName(index)}{cleared ? ' · 평범한 주민' : ''}
      </span>)}

    {investigating && activeBox && <span className="unsup-magnifier" style={activeBox} aria-hidden="true"><i /></span>}

    {blurry && <p className="unsup-blur-chip" role="status">군집이 섞여 흐릿해요</p>}
  </section>;
}
