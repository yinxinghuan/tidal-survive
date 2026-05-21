import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Leaderboard, useGameScore } from '@shared/leaderboard';
import { Scene } from './components/Scene';
import { SplashScene } from './components/SplashScene';
import { Tutorial } from './components/Tutorial';
import { Pellets } from './components/Pellets';
import { createGameState, TIDE_WARN_LEAD } from './hooks/useGameLoop';
import { useJoystick } from './hooks/useJoystick';
import { playSfx, startBgm, stopBgm, unlockAudio } from './utils/audio';
import { TIDE_INTERVAL, SHARK_DELAY_IN_WATER } from './constants';
import { t } from './i18n';
import alteruSvg from './img/alteru.svg';
import './TidalSurvive.less';
import './SplashScene.less';

type Phase = 'splash' | 'playing' | 'gameover';
const HIGH_KEY = 'tidal_survive_high';
const TUTORIAL_KEY = 'tidal_survive_tutorial_seen';

export function TidalSurvive() {
  const [phase, setPhase] = useState<Phase>('splash');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState<number>(() => Number(localStorage.getItem(HIGH_KEY) || 0));
  const [finalScore, setFinalScore] = useState(0);
  const [gameOverReason, setGameOverReason] = useState<'drowned' | 'shark'>('drowned');
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Death flash + tide-rise tick + HUD readouts
  const [waterFlash, setWaterFlash] = useState<{ key: number; kind: 'shark' | 'drown' } | null>(null);
  const [tidePulse, setTidePulse] = useState(0);
  const [tideCountdown, setTideCountdown] = useState(TIDE_INTERVAL);
  const [tideWarn, setTideWarn] = useState(false);
  const [tideEbb, setTideEbb] = useState(false);
  const [tideTargetLevel, setTideTargetLevel] = useState(1);
  const [waterLevelNow, setWaterLevelNow] = useState(0);
  const [sharkCountdown, setSharkCountdown] = useState<number | null>(null);
  const [startRitual, setStartRitual] = useState<'idle' | 'ready' | 'go' | 'done'>('done');
  const [tutorialStep, setTutorialStep] = useState<'move' | 'pickup' | 'drop' | 'tide' | 'done'>('done');
  const [carryHint, setCarryHint] = useState(false);
  const carryStartRef = useRef<number>(-1);

  const stateRef = useRef(createGameState());

  // Tap-to-drop: bumps a counter on the state ref so the game loop can react.
  const onTapToDrop = useCallback(() => {
    stateRef.current.tapDropPending += 1;
  }, []);
  const { stickRef, view } = useJoystick(phase === 'playing', onTapToDrop);

  const {
    isInAigram, submitScore, fetchLeaderboard,
  } = useGameScore();

  const haptic = useCallback((kind: 'light' | 'heavy') => {
    if (!('vibrate' in navigator)) return;
    navigator.vibrate(kind === 'heavy' ? 35 : 12);
  }, []);

  const onScore = useCallback((s: number) => setScore(s), []);

  const onWaterFlash = useCallback((kind: 'shark' | 'drown') => {
    const key = Date.now();
    setWaterFlash({ key, kind });
    setTimeout(() => setWaterFlash(cur => (cur && cur.key === key ? null : cur)), 1200);
  }, []);

  const onTideEvent = useCallback(() => {
    setTidePulse(p => p + 1);
  }, []);

  const onGameOver = useCallback((final: number, reason: 'drowned' | 'shark') => {
    setFinalScore(final);
    setGameOverReason(reason);
    setPhase('gameover');
    stopBgm();
    if (final > highScore) {
      localStorage.setItem(HIGH_KEY, String(final));
      setHighScore(final);
    }
    submitScore(final).catch(() => { /* silent */ });
  }, [highScore, submitScore]);

  const start = useCallback(async () => {
    await unlockAudio();
    const showTutorial = !localStorage.getItem(TUTORIAL_KEY);
    stateRef.current = createGameState(showTutorial);
    stateRef.current.startRitualSince = 0;
    setScore(0);
    setTideCountdown(TIDE_INTERVAL);
    setTutorialStep(showTutorial ? 'move' : 'done');
    setStartRitual('ready');
    setPhase('playing');
    startBgm(0.07);
  }, []);

  useEffect(() => () => { stopBgm(); }, []);

  // Tide countdown + warning + shark countdown + start ritual + tutorial step
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = window.setInterval(() => {
      const d = stateRef.current;
      const remaining = Math.max(0, d.nextTideAt - d.time);
      setTideCountdown(remaining);
      setTideWarn(d.tutorialStep === 'done' && remaining > 0 && remaining <= TIDE_WARN_LEAD);
      setTideEbb(d.isUpcomingEbb);
      setTideTargetLevel(d.isUpcomingEbb ? 0 : d.tideCyclePeak);
      setWaterLevelNow(Math.round(d.waterLevel));
      // Shark countdown: seconds until shark bites, while in water
      if (d.inWaterTime > 0.05 && !d.gameOver) {
        const remain = SHARK_DELAY_IN_WATER - d.inWaterTime;
        setSharkCountdown(Math.max(0, remain));
      } else {
        setSharkCountdown(null);
      }
      setStartRitual(d.startRitual);
      setTutorialStep(d.tutorialStep);
      // First-play: persist tutorial-seen flag once they reach 'done'
      if (d.tutorialStep === 'done' && !localStorage.getItem(TUTORIAL_KEY)) {
        localStorage.setItem(TUTORIAL_KEY, '1');
      }
      // Carry-time hint: after tutorial is done, prompt "tap to drop" whenever
      // the player has been holding an item for >1.2s. Disappears the instant
      // they drop. Auto-fades after 6s so it doesn't become noise.
      if (d.carrying && d.tutorialStep === 'done') {
        if (carryStartRef.current < 0) carryStartRef.current = d.time;
        const elapsed = d.time - carryStartRef.current;
        setCarryHint(elapsed >= 1.2 && elapsed <= 6.0);
      } else {
        if (carryStartRef.current >= 0) carryStartRef.current = -1;
        setCarryHint(false);
      }
    }, 80);
    return () => window.clearInterval(id);
  }, [phase]);

  const showCanvas = phase !== 'splash';
  const canvasFrameloop = phase === 'playing' ? 'always' : 'demand';

  const tideFraction = Math.min(1, tideCountdown / TIDE_INTERVAL);

  return (
    <div className="ts">
      {showCanvas && (
        <div className="ts__canvas">
          <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }} frameloop={canvasFrameloop}>
            <Scene
              state={stateRef}
              playing={phase === 'playing'}
              stickRef={stickRef}
              onScore={onScore}
              onGameOver={onGameOver}
              onWaterFlash={onWaterFlash}
              onTideEvent={onTideEvent}
              playSfx={playSfx}
              haptic={haptic}
            />
          </Canvas>
        </div>
      )}

      {/* Floating +N pellets — projected from world space each frame */}
      {phase === 'playing' && <Pellets stateRef={stateRef} />}

      {/* HUD */}
      {showCanvas && (
        <div className="ts__hud">
          <div className="ts__score">
            <div className="ts__score-label">SCORE</div>
            <div className="ts__score-value">{score}</div>
            {highScore > 0 && (
              <div className="ts__hi">
                <span>BEST</span>
                <span className="ts__hi-value">{highScore}</span>
              </div>
            )}
          </div>
          <img className="ts__watermark" src={alteruSvg} alt="AlterU" />
        </div>
      )}

      {/* Shark countdown — only when in water */}
      {phase === 'playing' && sharkCountdown !== null && sharkCountdown < SHARK_DELAY_IN_WATER && (
        <div className={`ts__shark-warn ${sharkCountdown < 0.8 ? 'ts__shark-warn--imminent' : ''}`}>
          <div className="ts__shark-warn-label">SHARK</div>
          <div className="ts__shark-warn-secs">{sharkCountdown.toFixed(1)}s</div>
        </div>
      )}

      {/* Tide countdown bar — v1.10 redesign:
          [ ▼ 0 ]   NOW 2 → NEXT 0    1.4s
          The big arrow + target water level tells the player at a glance
          whether the next event is a rise/ebb and HOW HIGH it'll go. */}
      {phase === 'playing' && (tutorialStep === 'tide' || tutorialStep === 'done') && (
        <div
          className={`ts__tidebar ${tideWarn ? 'ts__tidebar--warn' : ''} ${tideEbb ? 'ts__tidebar--ebb' : ''} ${tidePulse % 2 === 0 ? 'ts__tidebar--a' : 'ts__tidebar--b'}`}
          key={tidePulse}
        >
          <div className="ts__tidebar-glyph">
            <div className="ts__tidebar-arrow">{tideEbb ? '▼' : '▲'}</div>
            <div className="ts__tidebar-target">{tideTargetLevel}</div>
          </div>
          <div className="ts__tidebar-track">
            <div className="ts__tidebar-fill" style={{ width: `${tideFraction * 100}%` }} />
            <div className="ts__tidebar-now-label">
              <span className="ts__tidebar-now-num">{waterLevelNow}</span>
              <span className="ts__tidebar-arrow-mid">→</span>
              <span className="ts__tidebar-next-num">{tideTargetLevel}</span>
            </div>
          </div>
          <div className="ts__tidebar-secs">{tideCountdown.toFixed(1)}s</div>
        </div>
      )}

      {/* READY / GO ritual overlay */}
      {phase === 'playing' && (startRitual === 'ready' || startRitual === 'go') && (
        <div className="ts__ritual">
          <div className={`ts__ritual-word ts__ritual-word--${startRitual}`}>
            {startRitual === 'ready' ? 'READY' : 'GO!'}
          </div>
        </div>
      )}

      {/* Tutorial overlay */}
      {phase === 'playing' && tutorialStep !== 'done' && startRitual === 'done' && (
        <Tutorial step={tutorialStep} />
      )}

      {/* Carry-time hint — surfaces after the first-play tutorial, whenever
          the player has been holding an item for >1.2s without dropping. */}
      {phase === 'playing' && carryHint && (
        <div className="ts__drop-hint">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
            <path d="M9 11.24V7.5a2.5 2.5 0 0 1 5 0v3.74a6 6 0 1 0-5 0Zm9.84 4.63-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6a1.5 1.5 0 1 0-3 0v10.74l-3.44-.72a1.42 1.42 0 0 0-1.41 2.41l4.62 4.62c.28.28.66.44 1.06.44h6.79c.75 0 1.38-.55 1.49-1.29l.72-5.07a1.512 1.512 0 0 0-.99-1.76Z"/>
          </svg>
          <span>{t('tap_to_drop')}</span>
        </div>
      )}

      {waterFlash && (
        <div className={`ts__flash ts__flash--${waterFlash.kind}`} key={waterFlash.key} />
      )}

      {view.active && (
        <div className="ts__joystick" style={{ left: view.ox, top: view.oy }}>
          <div className="ts__joystick__ring">
            <div className="ts__joystick__stick" style={{ transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px))` }} />
          </div>
        </div>
      )}

      {phase === 'splash' && <SplashScene onStart={start} highScore={highScore} />}

      {phase === 'gameover' && (
        <div className="ts__gameover">
          <div className="ts__gameover-eyebrow">
            {finalScore > 0 && finalScore === highScore
              ? 'NEW RECORD'
              : (gameOverReason === 'shark' ? t('eaten') : t('drowned'))}
          </div>
          <div className="ts__final-score">{finalScore}</div>
          <div className="ts__final">
            {t('survived', { n: Math.floor(stateRef.current.time) })}
          </div>
          <button className="ts__cta" onPointerDown={start}>
            {t('again')}
          </button>
          <button className="ts__leaderboard-btn" onPointerDown={() => setShowLeaderboard(true)}>
            {t('leaderboard')}
          </button>
        </div>
      )}

      {showLeaderboard && (
        <Leaderboard
          gameName={t('title')}
          isInAigram={isInAigram}
          onClose={() => setShowLeaderboard(false)}
          fetch={fetchLeaderboard}
        />
      )}
    </div>
  );
}
