import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Leaderboard, useGameScore } from '@shared/leaderboard';
import { Scene } from './components/Scene';
import { SplashScene } from './components/SplashScene';
import { createGameState } from './hooks/useGameLoop';
import { useJoystick } from './hooks/useJoystick';
import { playSfx, startBgm, stopBgm, unlockAudio } from './utils/audio';
import { TIDE_INTERVAL } from './constants';
import { t } from './i18n';
import alteruSvg from './img/alteru.svg';
import './TidalSurvive.less';
import './SplashScene.less';

type Phase = 'splash' | 'playing' | 'gameover';
const HIGH_KEY = 'tidal_survive_high';

export function TidalSurvive() {
  const [phase, setPhase] = useState<Phase>('splash');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState<number>(() => Number(localStorage.getItem(HIGH_KEY) || 0));
  const [finalScore, setFinalScore] = useState(0);
  const [gameOverReason, setGameOverReason] = useState<'drowned' | 'shark'>('drowned');
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Floating water flash on death + tide-rise tick
  const [waterFlash, setWaterFlash] = useState<{ key: number; kind: 'shark' | 'drown' } | null>(null);
  const [tidePulse, setTidePulse] = useState(0);
  const [tideCountdown, setTideCountdown] = useState(TIDE_INTERVAL);

  const stateRef = useRef(createGameState());
  const { stickRef, view } = useJoystick(phase === 'playing');

  const {
    isInAigram, submitScore, fetchGlobalLeaderboard, fetchFriendsLeaderboard,
  } = useGameScore('tidal-survive');

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
    stateRef.current = createGameState();
    setScore(0);
    setTideCountdown(TIDE_INTERVAL);
    setPhase('playing');
    startBgm(0.07);
  }, []);

  useEffect(() => () => { stopBgm(); }, []);

  // Tide countdown HUD — read from state.current.nextTideAt - state.current.time
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = window.setInterval(() => {
      const d = stateRef.current;
      const remaining = Math.max(0, d.nextTideAt - d.time);
      setTideCountdown(remaining);
    }, 100);
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

      {/* Tide countdown bar */}
      {phase === 'playing' && (
        <div className={`ts__tidebar ${tidePulse % 2 === 0 ? 'ts__tidebar--a' : 'ts__tidebar--b'}`} key={tidePulse}>
          <div className="ts__tidebar-label">NEXT TIDE</div>
          <div className="ts__tidebar-track">
            <div className="ts__tidebar-fill" style={{ width: `${tideFraction * 100}%` }} />
          </div>
          <div className="ts__tidebar-secs">{tideCountdown.toFixed(1)}s</div>
        </div>
      )}

      {/* Water flash on death (red for shark, blue for drown) */}
      {waterFlash && (
        <div className={`ts__flash ts__flash--${waterFlash.kind}`} key={waterFlash.key} />
      )}

      {/* Joystick visual */}
      {view.active && (
        <div className="ts__joystick" style={{ left: view.ox, top: view.oy }}>
          <div className="ts__joystick__ring">
            <div className="ts__joystick__stick" style={{ transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px))` }} />
          </div>
        </div>
      )}

      {/* Splash */}
      {phase === 'splash' && <SplashScene onStart={start} highScore={highScore} />}

      {/* Game over */}
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
          fetchGlobal={fetchGlobalLeaderboard}
          fetchFriends={fetchFriendsLeaderboard}
        />
      )}
    </div>
  );
}
