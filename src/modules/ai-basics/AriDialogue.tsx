import type { ReactNode } from 'react';
import fairyNeutral from '../../../assets/ai/fairy.png';
import fairyHappy from '../../../assets/ai/fairy_happy.png';
import fairySad from '../../../assets/ai/fairy_sad.png';
import './aiBasics.css';

export type AriExpression = 'neutral' | 'happy' | 'disappointed';

const ARI_PORTRAITS: Record<AriExpression, string> = {
  neutral: fairyNeutral,
  happy: fairyHappy,
  disappointed: fairySad,
};

export function AriDialogue({
  text,
  expression = 'neutral',
  onNext,
  nextLabel = '다음',
  showSpaceHint = false,
  inline = false,
  children,
}: {
  text: string;
  expression?: AriExpression;
  onNext?: () => void;
  nextLabel?: string;
  showSpaceHint?: boolean;
  inline?: boolean;
  children?: ReactNode;
}) {
  const panel = <section className="ai-dialogue-panel" role="dialog" aria-label="아리의 설명">
    <div className="ai-dialogue-portrait" data-expression={expression} aria-hidden="true">
      <img src={ARI_PORTRAITS[expression]} alt="" />
    </div>
    <div className="ai-dialogue-copy">
      <strong>아리</strong>
      <p>{text}</p>
      {children}
      {onNext && <button type="button" onClick={onNext}>{nextLabel}</button>}
    </div>
  </section>;
  if (inline) return <div className="ai-dialogue-inline">{panel}</div>;
  return <div className="overlay ai-dialogue-overlay">
    {showSpaceHint && <span className="ai-space-hint" aria-hidden="true">[ SPACE ]</span>}
    {panel}
  </div>;
}
