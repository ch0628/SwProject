// 비지도학습 화면 에셋 경로 (교체 지점). 주민 스프라이트는 data/residents.ts, 장면 배경은 unsupervised.css 상단 변수에 있다.
import { characterAssetPath } from '../../characterManifest';
import fairyImg from '../../../assets/ai/fairy.png';
import type { Speaker } from './data/dialogue';

/** 대사 박스 초상. 결정 10: AI 보안관은 1차에 기존 강아지(dog male) 스프라이트를 재사용한다. */
export const PORTRAITS: Readonly<Record<Speaker, string>> = Object.freeze({
  '아리': fairyImg,
  'AI 보안관': characterAssetPath('dog', 'male', 'down'),
});
