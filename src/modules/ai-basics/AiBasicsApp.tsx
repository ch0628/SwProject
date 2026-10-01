import { useEffect, useRef, useState } from 'react';
import * as Phaser from 'phaser';
import { LOGICAL } from '../../config';
import { AiBasicsScene } from './AiBasicsScene';
import { cardResult, quizResult } from './challenge';
import { NOTES, type Note } from './notes';
import cardFront from '../../../assets/cards/card_front.png';
import cardBack from '../../../assets/cards/card_back.png';
import deviceEmpty from '../../../assets/card_insert_device/card_insert_device.png';
import device1 from '../../../assets/card_insert_device/card_insert_device_1.png';
import device2 from '../../../assets/card_insert_device/card_insert_device_2.png';
import device3 from '../../../assets/card_insert_device/card_insert_device_3.png';
import deviceFinal from '../../../assets/card_insert_device/card_insert_device_final.png';
import fairyNeutral from '../../../assets/ai/fairy.png';
import fairyHappy from '../../../assets/ai/fairy_happy.png';
import fairySad from '../../../assets/ai/fairy_sad.png';
import problem1Cut1 from '../../../assets/wrong_answer_cut_scene/problem_1/problem1_cut_scene_1.png';
import problem1Cut2 from '../../../assets/wrong_answer_cut_scene/problem_1/problem1_cut_scene_2.png';
import problem2Cut1 from '../../../assets/wrong_answer_cut_scene/problem_2/problem2_cut_scene_1.png';
import problem2Cut2 from '../../../assets/wrong_answer_cut_scene/problem_2/problem2_cut_scene_2.png';
import problem2Cut3 from '../../../assets/wrong_answer_cut_scene/problem_2/problem2_cut_scene_3.png';
import problem3ElevatorCut1 from '../../../assets/wrong_answer_cut_scene/problem_3/type_1/problem3-1_cut_scene_1.png';
import problem3ElevatorCut2 from '../../../assets/wrong_answer_cut_scene/problem_3/type_1/problem3-1_cut_scene_2.png';
import problem3VacuumCut1 from '../../../assets/wrong_answer_cut_scene/problem_3/type_2/problem3-2_cut_scene_1.png';
import problem3VacuumCut2 from '../../../assets/wrong_answer_cut_scene/problem_3/type_2/problem3-2_cut_scene_2.png';
import './aiBasics.css';

type Phase = 'intro' | 'explore' | 'reveal' | 'quiz' | 'feedback' | 'cutscene' | 'select' | 'failure' | 'insert' | 'powerZoomOut' | 'power1' | 'power2' | 'ending' | 'complete';
type Speaker = '???' | 'Ari';
const INTRO: [Speaker, string][] = [
  ['???', '거기 누구야?'],
  ['???', '여기는 지금 전원이 꺼져 있어.'],
  ['???', '안쪽으로 가려면,\n여기저기 흩어진 카드 6개를 모두 찾아봐.'],
  ['???', '전부 찾았다면 길 끝까지 와.\n내가 기다리고 있을게.'],
];
const REVEAL: [Speaker, string][] = [
  ['???', '여기까지 잘 왔네!'],
  ['Ari', '아까부터 너한테 말하고 있던 건 바로 나였어.'],
  ['Ari', '나는 이 제어실을 지키는 아리야.'],
  ['Ari', '카드 6개도 전부 찾았네.'],
  ['Ari', '그럼 카드에서 본 내용을\n정말 이해했는지 확인해볼까?'],
  ['Ari', '세 문제를 풀면 돼!'],
];
const FAILURE = [
  '아쉽네... 하트가 모두 없어졌어.',
  '다시 처음부터 길을 따라가면서\n카드 내용을 하나씩 확인해 보자.',
  '이번엔 분명 더 잘할 수 있을 거야!',
];
const QUIZ = [
  { question: '버튼을 누르면 정해진 시간 동안 작동하고, 시간이 지나면 자동으로 꺼지는 전등이 있어요.\n이 전등은 AI일까요?', options: ['O', 'X'], answer: 'X', reason: '정해진 규칙에 따라 자동으로 작동하는 것만으로는 AI라고 할 수 없어요. AI는 데이터를 학습하고 판단할 수 있어요.' },
  { question: 'AI에게 강아지와 고양이 사진을 여러 장 보여주었어요.\nAI는 사진에서 반복되는 특징을 학습한 뒤, 처음 보는 사진이 강아지인지 고양이인지 판단했어요.\n이것은 AI를 사용한 사례일까요?', options: ['O', 'X'], answer: 'O', reason: '데이터에서 특징과 패턴을 배우고, 처음 보는 사진을 판단했기 때문에 AI를 사용한 사례예요.' },
  { question: '다음 중 AI를 사용하고 있는 것은 무엇일까요?', options: ['1. 엘리베이터가 버튼을 누른 층으로 이동한다.', '2. 로봇청소기가 정해진 시간에 작동하여 집 안을 청소한다.', '3. 스피커가 사람의 말을 듣고 질문의 내용을 파악하여 알맞은 답을 한다.'], answer: '3. 스피커가 사람의 말을 듣고 질문의 내용을 파악하여 알맞은 답을 한다.', reason: '말의 내용을 파악해 알맞은 답을 만드는 스피커가 AI를 활용한 사례예요.' },
];
const WRONG_CUTSCENES: Record<number, Record<string, { images: string[]; explanation: string }>> = {
  0: { O: { images: [problem1Cut1, problem1Cut2], explanation: '이 전등은 정해진 규칙대로 켜졌다가 꺼진 거야.\n데이터를 배우고 스스로 판단한 건 아니야.' } },
  1: { X: { images: [problem2Cut1, problem2Cut2, problem2Cut3], explanation: '여러 사진에서 반복되는 특징을 배우고,\n그걸 이용해서 처음 보는 사진까지 판단했어.\n이런 게 AI가 하는 일이야.' } },
  2: {
    [QUIZ[2].options[0]]: { images: [problem3ElevatorCut1, problem3ElevatorCut2], explanation: '엘리베이터는 사람이 누른 버튼 신호에 따라\n정해진 방식으로 움직인 거야.\n스스로 학습해서 판단한 건 아니야.' },
    [QUIZ[2].options[1]]: { images: [problem3VacuumCut1, problem3VacuumCut2], explanation: '정해진 시간이 되자\n미리 설정된 대로 움직이기 시작한 거야.\n그것만으로 AI라고 할 수는 없어.' },
  },
};
const ENDING = [
  '성공했어! 제어실의 전원이 모두 돌아왔어!',
  'AI는 데이터를 보고 패턴을 배우고, 새로운 상황을 판단할 수 있어.',
  '정해진 방식대로만 움직이는 기계와 어떤 점이 다른지 이제 알겠지?',
];
const DEVICES = [deviceEmpty, device1, device2, device3, deviceFinal];
type AriExpression = 'neutral' | 'happy' | 'disappointed';
const ARI_PORTRAITS: Record<AriExpression, string> = { neutral: fairyNeutral, happy: fairyHappy, disappointed: fairySad };

function AiBasicsDialogue({ speaker, text, expression = 'neutral', onNext, nextLabel = '다음' }: {
  speaker: Speaker; text: string; expression?: AriExpression; onNext: () => void; nextLabel?: string;
}) {
  return <div className="overlay ai-dialogue-overlay"><span className="ai-space-hint" aria-hidden="true">[ SPACE ]</span><section className="ai-dialogue-panel" role="dialog" aria-label="대화">
    <div className="ai-dialogue-portrait" data-expression={speaker === 'Ari' ? expression : undefined} aria-hidden="true">
      {speaker === 'Ari' ? <img src={ARI_PORTRAITS[expression]} alt="" /> : <span>?</span>}
    </div>
    <div className="ai-dialogue-copy"><strong>{speaker}</strong><p>{text}</p><button type="button" onClick={onNext}>{nextLabel}</button></div>
  </section></div>;
}

function CardFront({ note, selected, onClick, onPreview }: { note: Note; selected?: boolean; onClick?: () => void; onPreview?: () => void }) {
  const content = <><img src={cardFront} alt="" /><strong>{note.title}</strong><p>{note.body}</p></>;
  return onClick
    ? <button type="button" className={`ai-card-front ${selected ? 'selected' : ''}`} aria-pressed={!!selected} onClick={onClick} onFocus={onPreview} onMouseEnter={onPreview}>{content}</button>
    : <div className="ai-card-front">{content}</div>;
}

export function AiBasicsApp() {
  const mount = useRef<HTMLDivElement>(null);
  const scene = useRef<AiBasicsScene | null>(null);
  const collectedRef = useRef<string[]>([]);
  const [phase, setPhase] = useState<Phase>('intro');
  const [line, setLine] = useState(0);
  const [collected, setCollected] = useState<string[]>([]);
  const [openCard, setOpenCard] = useState<Note | null>(null);
  const [hint, setHint] = useState('');
  const [hearts, setHearts] = useState(3);
  const [question, setQuestion] = useState(0);
  const [feedbackStep, setFeedbackStep] = useState(0);
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);
  const [wrongCutscene, setWrongCutscene] = useState<{ images: string[]; explanation: string } | null>(null);
  const [cutIndex, setCutIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [previewId, setPreviewId] = useState(NOTES[0].id);
  const [warning, setWarning] = useState('');
  const [deviceIndex, setDeviceIndex] = useState(0);
  const [endingLine, setEndingLine] = useState(0);

  useEffect(() => {
    const aiScene = new AiBasicsScene(note => {
      const next = [...collectedRef.current, note.id];
      collectedRef.current = next;
      setCollected(next);
      setOpenCard(note);
      setHint(next.length === 1 ? '좋아. 그런 카드가 앞으로 5개 더 있어.' : next.length === NOTES.length ? '전부 찾았네. 그럼 계속 앞으로 와.' : '');
    }, () => { setLine(0); setHint(''); setPhase('reveal'); });
    scene.current = aiScene;
    const game = new Phaser.Game({
      type: Phaser.AUTO, parent: mount.current!, width: LOGICAL.width, height: LOGICAL.height,
      backgroundColor: '#101827', pixelArt: true, roundPixels: true,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: [aiScene],
    });
    return () => { game.destroy(true); scene.current = null; };
  }, []);

  useEffect(() => { scene.current?.setBlocked(phase !== 'explore' || !!openCard); }, [phase, openCard]);
  useEffect(() => {
    if (!openCard) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpenCard(null); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [openCard]);
  useEffect(() => {
    if (phase === 'powerZoomOut') {
      let active = true;
      void scene.current?.showWholeMap().then(() => { if (active) setPhase('power1'); });
      return () => { active = false; };
    }
    if (phase === 'power1') scene.current?.setPowerStage(1);
    if (phase === 'power2') scene.current?.setPowerStage(2);
    if (phase === 'insert') {
      const timer = window.setTimeout(() => deviceIndex < 4 ? setDeviceIndex(deviceIndex + 1) : setPhase('powerZoomOut'), 850);
      return () => window.clearTimeout(timer);
    }
    if (phase === 'power1') {
      const timer = window.setTimeout(() => setPhase('power2'), 1000);
      return () => window.clearTimeout(timer);
    }
    if (phase === 'power2') {
      let active = true;
      const timer = window.setTimeout(() => {
        void scene.current?.restoreCamera().then(() => { if (active) setPhase('ending'); });
      }, 1100);
      return () => { active = false; window.clearTimeout(timer); };
    }
  }, [phase, deviceIndex]);

  const advanceDialogue = () => {
    if (phase === 'failure') {
      if (line < FAILURE.length - 1) setLine(line + 1);
      else resetRun();
      return;
    }
    const lines = phase === 'intro' ? INTRO : REVEAL;
    if (line < lines.length - 1) { if (phase === 'reveal' && line === 0) scene.current?.revealAri(); setLine(line + 1); }
    else if (phase === 'intro') setPhase('explore');
    else { setHearts(3); setQuestion(0); setPhase('quiz'); }
  };
  const nextQuestion = () => { if (question === QUIZ.length - 1) setPhase('select'); else { setQuestion(question + 1); setPhase('quiz'); } };
  const resetRun = () => {
    scene.current?.reset();
    collectedRef.current = [];
    setCollected([]); setOpenCard(null); setHint(''); setSelected([]); setWarning('');
    setQuestion(0); setHearts(3); setFeedbackStep(0); setFeedbackCorrect(false); setWrongCutscene(null); setCutIndex(0);
    setPreviewId(NOTES[0].id); setDeviceIndex(0); setEndingLine(0); setLine(0); setPhase('explore');
  };
  const failChallenge = () => { setHearts(0); setLine(0); setPhase('failure'); };
  const answer = (choice: string) => {
    if (phase !== 'quiz') return;
    const correct = choice === QUIZ[question].answer;
    const result = quizResult(hearts, correct);
    setFeedbackCorrect(correct);
    setFeedbackStep(0);
    setHearts(result.hearts);
    if (!correct) { setWrongCutscene(WRONG_CUTSCENES[question][choice]); setCutIndex(0); }
    setPhase('feedback');
  };
  const advanceFeedback = () => {
    if (feedbackCorrect) nextQuestion();
    else if (feedbackStep === 0) setPhase('cutscene');
    else if (hearts === 0) failChallenge();
    else nextQuestion();
  };
  const advanceCutscene = () => {
    if (!wrongCutscene) return;
    if (cutIndex < wrongCutscene.images.length - 1) setCutIndex(cutIndex + 1);
    else { setFeedbackStep(1); setPhase('feedback'); }
  };
  const advanceEnding = () => endingLine < ENDING.length - 1 ? setEndingLine(endingLine + 1) : setPhase('complete');
  const toggleSelection = (id: string) => {
    setWarning('');
    setSelected(current => current.includes(id) ? current.filter(item => item !== id) : current.length < 3 ? [...current, id] : current);
  };
  const insert = () => {
    if (phase !== 'select') return;
    const result = cardResult(hearts, selected);
    if (result.outcome === 'incomplete') { setWarning('AI 카드 3장을 모두 선택해야 해!'); return; }
    if (result.outcome === 'failed') { failChallenge(); return; }
    if (result.outcome === 'retry') {
      setHearts(result.hearts);
      setSelected([]);
      setWarning('AI의 특징을 설명하는 카드 3장을 다시 골라봐!');
      return;
    }
    setDeviceIndex(0); setPhase('insert');
  };

  useEffect(() => {
    const onSpace = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      if (!openCard && !['intro', 'reveal', 'feedback', 'cutscene', 'failure', 'ending'].includes(phase)) return;
      event.preventDefault();
      if (event.repeat) return;
      if (openCard) setOpenCard(null);
      else if (phase === 'feedback') advanceFeedback();
      else if (phase === 'cutscene') advanceCutscene();
      else if (phase === 'ending') advanceEnding();
      else advanceDialogue();
    };
    window.addEventListener('keydown', onSpace, true);
    return () => window.removeEventListener('keydown', onSpace, true);
  });

  const dialogue = phase === 'intro' ? INTRO[line] : phase === 'reveal' ? REVEAL[line] : phase === 'failure' ? ['Ari', FAILURE[line]] as [Speaker, string] : null;
  return <main className="stage ai-basics-stage">
    <div ref={mount} className="game" aria-label="AI Basics 3층 제어실" />
    <header className="ai-notes-hud" aria-label="모은 카드">
      {NOTES.map((note, index) => {
        const owned = collected.includes(note.id);
        return <button key={note.id} type="button" disabled={!owned} aria-label={`${index + 1}번 카드: ${owned ? note.title : '아직 못 찾음'}`} onClick={() => setOpenCard(note)}>
          {owned ? <img src={cardBack} alt="" /> : <span>{index + 1}</span>}
        </button>;
      })}
    </header>
    {phase === 'explore' && hint && !openCard && <aside className="ai-hint"><strong>???</strong><span>{hint}</span><button onClick={() => setHint('')}>확인</button></aside>}
    {(phase === 'quiz' || phase === 'feedback' || phase === 'cutscene' || phase === 'select' || phase === 'failure') && <div className="ai-hearts" aria-label={`남은 하트 ${hearts}개`}>{'♥'.repeat(hearts)}{'♡'.repeat(3 - hearts)}</div>}

    {openCard && <div className="overlay ai-note-overlay" onClick={() => setOpenCard(null)}>
      <article className="ai-note-dialog" role="dialog" aria-modal="true" aria-label={openCard.title} onClick={event => event.stopPropagation()}>
        <button className="ai-note-close" type="button" aria-label="카드 닫기" onClick={() => setOpenCard(null)}>×</button>
        <CardFront note={openCard} />
      </article>
    </div>}

    {dialogue && <AiBasicsDialogue speaker={dialogue[0]} text={dialogue[1]} expression={phase === 'failure' ? 'disappointed' : 'neutral'} onNext={advanceDialogue} nextLabel={phase === 'reveal' && line === REVEAL.length - 1 ? '도전하기' : '다음'} />}

    {phase === 'quiz' && <div className="overlay ai-quiz-overlay"><section className="ai-panel ai-quiz-panel" role="dialog" aria-label="최종 퀴즈">
      <small>문제 {question + 1} / 3</small><h2>{QUIZ[question].question}</h2>
      <div className="ai-options">{QUIZ[question].options.map(option => <button key={option} onClick={() => answer(option)}>{option}</button>)}</div>
    </section></div>}

    {phase === 'feedback' && <AiBasicsDialogue speaker="Ari" expression={feedbackCorrect ? 'happy' : 'disappointed'}
      text={feedbackCorrect ? '정답이야! 잘했어.' : feedbackStep === 0 ? '다시 생각해보자\n괜찮아. 차근차근 살펴보자!' : wrongCutscene!.explanation}
      onNext={advanceFeedback} nextLabel={!feedbackCorrect && feedbackStep === 1 ? hearts === 0 ? '계속' : '다음 문제' : '다음'} />}

    {phase === 'cutscene' && wrongCutscene && <div className="overlay ai-cutscene-overlay"><span className="ai-space-hint" aria-hidden="true">[ SPACE ]</span>
      <section className="ai-cutscene-panel" role="dialog" aria-label={`오답 컷신 ${cutIndex + 1} / ${wrongCutscene.images.length}`}>
        <img src={wrongCutscene.images[cutIndex]} alt={`오답 설명 장면 ${cutIndex + 1}`} />
        <button type="button" onClick={advanceCutscene}>다음</button>
      </section>
    </div>}

    {phase === 'select' && <div className="overlay ai-flow-overlay"><section className="ai-selection" role="dialog" aria-label="AI 특징 카드 선택">
      <h2>AI의 특징을 설명하는 카드 3장을 골라봐!</h2>
      <div className="ai-selection-content"><div className="ai-selection-grid">{NOTES.map(note => <CardFront key={note.id} note={note} selected={selected.includes(note.id)} onPreview={() => setPreviewId(note.id)} onClick={() => toggleSelection(note.id)} />)}</div>
        <div className="ai-selection-preview"><span>카드 내용을 크게 봐!</span><CardFront note={NOTES.find(note => note.id === previewId)!} /></div></div>
      <p aria-live="polite">{warning || `${selected.length} / 3장 선택`}</p><button className="ai-primary" onClick={insert}>넣기</button>
    </section></div>}

    {phase === 'insert' && <div className="overlay ai-flow-overlay"><section className="ai-panel ai-device-panel" role="dialog" aria-label="카드 삽입 장치">
      <h2>카드 삽입 장치</h2><div className="ai-device-image"><img src={DEVICES[deviceIndex]} alt={`카드 ${Math.min(deviceIndex, 3)}장 삽입된 장치`} /></div>
      {deviceIndex < 4 && <img key={deviceIndex} className="ai-insert-back" src={cardBack} alt="장치로 들어가는 카드 뒷면" />}<p>{deviceIndex < 4 ? `${deviceIndex} / 3장 삽입` : '장치가 작동하기 시작했어!'}</p>
    </section></div>}
    {(phase === 'power1' || phase === 'power2') && <div className="ai-power-label" role="status">{phase === 'power1' ? '제어실 조명이 켜졌어!' : '제어실 시스템이 모두 켜졌어!'}</div>}
    {phase === 'ending' && <AiBasicsDialogue speaker="Ari" expression="happy" text={ENDING[endingLine]}
      onNext={advanceEnding} nextLabel={endingLine === ENDING.length - 1 ? '완료' : '다음'} />}
    {phase === 'complete' && <div className="overlay ai-flow-overlay"><section className="ai-panel" role="dialog" aria-label="완료"><h1>AI가 무엇인지 이해하기 완료!</h1><button type="button" onClick={() => window.location.assign('/')}>첫 화면으로 돌아가기</button></section></div>}
  </main>;
}
