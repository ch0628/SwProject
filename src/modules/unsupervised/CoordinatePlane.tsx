// Scene 4~7 좌표평면 (1차: DOM, Phaser 없음). 상태를 받아 그리기만 한다.
import { characterAssetPath } from '../../characterManifest';
import type { Cluster, FeaturePair, ProjectedPoint, ResidentId } from './sim/clusteringEngine';
import { FEATURE_DEFINITIONS } from './data/features';
import type { ResidentDefinition } from './data/residents';
import { SPECIES_NAME, clusterName } from './labels';

const PAD = 8;
const SPAN = 100 - PAD * 2;
const CLUSTER_PAD = 0.08;
const left = (x: number) => PAD + x * SPAN;
const top = (y: number) => PAD + (1 - y) * SPAN;

type Props = {
  pair: FeaturePair;
  residents: readonly ResidentDefinition[];
  points: readonly ProjectedPoint[] | null;
  clusters: readonly Cluster[] | null;
  blurry: boolean;
  clickable: boolean;
  activeClusterId: string | null;
  clearedClusterIds: readonly string[];
  revealedVillainIds: readonly ResidentId[];
  onClusterClick: (clusterId: string) => void;
};

export function CoordinatePlane(props: Props) {
  const { pair, residents, points, clusters, blurry, clickable, activeClusterId, clearedClusterIds, revealedVillainIds, onClusterClick } = props;
  const [xKey, yKey] = pair;
  const xDef = FEATURE_DEFINITIONS[xKey];
  const yDef = FEATURE_DEFINITIONS[yKey];
  const byId = new Map(residents.map((resident) => [resident.id, resident]));
  const pointById = new Map(points?.map((point) => [point.id, point]) ?? []);
  const boxes = (clusters ?? []).map((cluster, index) => {
    const members = cluster.memberIds.map((id) => pointById.get(id)!);
    const minX = Math.max(0, Math.min(...members.map((p) => p.x)) - CLUSTER_PAD);
    const maxX = Math.min(1, Math.max(...members.map((p) => p.x)) + CLUSTER_PAD);
    const minY = Math.max(0, Math.min(...members.map((p) => p.y)) - CLUSTER_PAD);
    const maxY = Math.min(1, Math.max(...members.map((p) => p.y)) + CLUSTER_PAD);
    const box = { left: `${left(minX)}%`, top: `${top(maxY)}%`, width: `${(maxX - minX) * SPAN}%`, height: `${(maxY - minY) * SPAN}%` };
    return { cluster, index, box, cleared: clearedClusterIds.includes(cluster.id) };
  });

  return <section className={`unsup-plane${blurry ? ' is-blurry' : ''}`} aria-label={`좌표평면: 가로 ${xDef.label}, 세로 ${yDef.label}`}>
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

    {points?.map((point) => {
      const resident = byId.get(point.id)!;
      const revealed = revealedVillainIds.includes(point.id);
      return <figure key={point.id} className={`unsup-resident${revealed ? ' is-villain' : ''}`} style={{ left: `${left(point.x)}%`, top: `${top(point.y)}%` }}>
        <img src={characterAssetPath(resident.sprite.species, resident.sprite.gender, 'down')} alt="" />
        <figcaption>{SPECIES_NAME[resident.species]}{revealed ? ' · 악당' : ''}</figcaption>
      </figure>;
    })}

    {/* 이름표는 주민 스프라이트에 가려지지 않도록 마지막에 그린다 */}
    {boxes.map(({ cluster, index, box, cleared }) =>
      <span key={cluster.id} className={`unsup-cluster-name${cleared ? ' is-cleared' : ''}`} style={{ left: `calc(${box.left} + ${box.width} / 2)`, top: box.top }} aria-hidden="true">
        {clusterName(index)}{cleared ? ' · 평범한 주민' : ''}
      </span>)}

    {blurry && <p className="unsup-blur-chip" role="status">군집이 섞여 흐릿해요</p>}
  </section>;
}
