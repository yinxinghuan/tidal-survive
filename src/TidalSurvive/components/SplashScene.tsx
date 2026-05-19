// Pure SVG/CSS splash. No 3D Canvas → safe to mount during Aigram preload.
// v1.12 cinematic redesign: stranded sailor on a shrinking atoll under a
// stormy dusk sky, with sharks circling. The poster captures this scene;
// onboarding is now handled by the in-game tutorial.
import { useState } from 'react';
import { t } from '../i18n';

interface RainDrop {
  id: number;
  x: number;
  delay: number;
  duration: number;
  length: number;
  opacity: number;
}

export function SplashScene({ onStart, highScore }: { onStart: () => void; highScore: number }) {
  // Slanted rain streaks driven by CSS keyframes.
  const [rain] = useState<RainDrop[]>(() =>
    Array.from({ length: 32 }, (_, i) => ({
      id: i,
      x: Math.random() * 110 - 5,
      delay: -Math.random() * 4,
      duration: 0.9 + Math.random() * 0.7,
      length: 18 + Math.random() * 26,
      opacity: 0.18 + Math.random() * 0.32,
    }))
  );

  return (
    <div className="ts-splash">
      {/* Sky gradient — bruised dusk with storm overhead */}
      <div className="ts-splash__sky" />

      {/* Storm cloud layer — heavy at the top, with one bright sun gap */}
      <svg className="ts-splash__clouds" viewBox="0 0 800 320" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
        {/* Background haze cloud */}
        <ellipse cx="200" cy="40" rx="280" ry="60" fill="#1a2230" opacity=".75" />
        <ellipse cx="540" cy="20" rx="320" ry="55" fill="#1a2230" opacity=".75" />
        {/* Mid-distance cloud bank */}
        <ellipse cx="120" cy="90"  rx="180" ry="38" fill="#252e3c" opacity=".95" />
        <ellipse cx="320" cy="80"  rx="200" ry="42" fill="#252e3c" opacity=".95" />
        <ellipse cx="540" cy="100" rx="240" ry="40" fill="#252e3c" opacity=".95" />
        <ellipse cx="720" cy="78"  rx="160" ry="36" fill="#252e3c" opacity=".95" />
        {/* Front cloud — darkest, frames the sun gap */}
        <ellipse cx="300" cy="140" rx="200" ry="34" fill="#11161e" opacity=".95" />
        <ellipse cx="600" cy="135" rx="220" ry="36" fill="#11161e" opacity=".95" />
        {/* Sun glow seeping through cloud gap */}
        <circle cx="450" cy="150" r="100" fill="#ff8a3a" opacity=".35" filter="url(#sunBlur)" />
        <circle cx="450" cy="160" r="55"  fill="#ffb46a" opacity=".55" filter="url(#sunBlur)" />
        <defs>
          <filter id="sunBlur"><feGaussianBlur stdDeviation="12" /></filter>
        </defs>
      </svg>

      {/* Lightning flash — occasional bright streak (CSS-driven) */}
      <div className="ts-splash__lightning" aria-hidden />

      {/* Rain streaks */}
      <div className="ts-splash__rain" aria-hidden>
        {rain.map(r => (
          <div
            key={r.id}
            className="ts-splash__raindrop"
            style={{
              left: `${r.x}%`,
              height: `${r.length}px`,
              opacity: r.opacity,
              animationDelay: `${r.delay}s`,
              animationDuration: `${r.duration}s`,
            }}
          />
        ))}
      </div>

      {/* Ocean horizon + tiny atoll + circling sharks. Replaces the old
          "sandbar" silhouette — now reads as a tiny dying island in open
          water, with menace circling. */}
      <div className="ts-splash__ocean">
        <svg viewBox="0 0 800 380" preserveAspectRatio="xMidYMax slice" width="100%" height="100%">
          {/* Distant horizon line */}
          <rect x="0" y="0" width="800" height="200" fill="#1c2c44" />
          <rect x="0" y="200" width="800" height="180" fill="#0d1928" />
          {/* Horizon line — a thin highlight where sky meets sea */}
          <rect x="0" y="200" width="800" height="2" fill="#314a68" opacity=".7" />

          {/* Far swells — gentle waves across the horizon */}
          {Array.from({ length: 5 }, (_, i) => (
            <path
              key={`swell_${i}`}
              d={`M -10 ${220 + i * 18} Q 200 ${214 + i * 18} 400 ${220 + i * 18} T 810 ${220 + i * 18}`}
              fill="none"
              stroke="#284a6a"
              strokeWidth="1.4"
              opacity={(0.55 - i * 0.09).toFixed(2)}
            />
          ))}

          {/* Wave crest streaks — irregular foam lines */}
          {[
            { x: 90,  y: 290, w: 110, op: .4 },
            { x: 240, y: 305, w: 90,  op: .35 },
            { x: 460, y: 295, w: 130, op: .42 },
            { x: 630, y: 312, w: 100, op: .35 },
          ].map((s, i) => (
            <ellipse key={`crest_${i}`} cx={s.x} cy={s.y} rx={s.w} ry={3} fill="#e8f3fb" opacity={s.op} />
          ))}

          {/* Atoll ripple ring — wide ellipse showing where waves break on the island shoal */}
          <ellipse cx="400" cy="298" rx="180" ry="14" fill="none" stroke="#e8f3fb" strokeWidth="2" opacity=".55" />
          <ellipse cx="400" cy="298" rx="210" ry="18" fill="none" stroke="#e8f3fb" strokeWidth="1.2" opacity=".30" />

          {/* THE ATOLL — a much smaller island than v1.11. Half-submerged
              with a single rock stack and the lone sailor. */}
          {/* Wet base ellipse */}
          <ellipse cx="400" cy="306" rx="120" ry="10" fill="#1a2a3a" opacity=".85" />
          {/* Sand */}
          <path
            d="M 320,304 Q 360,288 400,286 Q 440,286 480,290 Q 500,296 480,304 Z"
            fill="#c69c5e"
          />
          <path
            d="M 332,302 Q 370,290 400,288 Q 430,288 466,292 Q 480,298 466,302 Z"
            fill="#e6cf9c"
          />
          {/* Rock stack on the atoll — taller now */}
          <rect x="378" y="262" width="14" height="24" rx="3" fill="#56504a" />
          <rect x="374" y="252" width="22" height="12" rx="3" fill="#7a7068" />
          {/* Tiny palm-tree stump suggesting hardship */}
          <rect x="424" y="276" width="3" height="10" fill="#6a4a2a" />
          <path d="M 425,272 Q 432,266 437,270 M 425,272 Q 418,266 413,270 M 425,272 L 425,278" stroke="#3e5e36" strokeWidth="1.6" fill="none" />

          {/* The sailor — small, central, looking out to sea (orange life
              jacket is the focal point) */}
          <g transform="translate(404, 246)">
            <rect x="-3" y="14" width="6" height="12" fill="#21314a" />
            <rect x="-7" y="2"  width="14" height="13" rx="3" fill="#ff8b3a" />
            <rect x="-8" y="5"  width="16" height="3"  fill="#c25e1c" />
            <circle cx="0" cy="-3" r="5" fill="#f0c9a3" />
            <rect x="-5" y="-9" width="10" height="3" rx="1" fill="#f6f7fa" />
            <rect x="-6" y="-7" width="12" height="2" fill="#1b2a40" />
          </g>

          {/* Floating debris in the foreground water — plank pieces */}
          <g transform="translate(180, 326) rotate(-12)">
            <rect x="-22" y="0" width="44" height="6" rx="1.5" fill="#a86a3a" />
            <rect x="-22" y="2" width="44" height="1.5" fill="#7a4823" />
          </g>
          <g transform="translate(580, 332) rotate(18)">
            <rect x="-16" y="0" width="32" height="5" rx="1.5" fill="#7a4823" />
          </g>
          <g transform="translate(640, 318) rotate(-30)">
            <rect x="-10" y="0" width="20" height="4" rx="1" fill="#5a3818" />
          </g>

          {/* SHARKS circling. Three fins of varying size/distance to suggest
              an encircling pack. */}
          {/* Near-left shark — biggest, closest */}
          <g transform="translate(220, 354)">
            <ellipse cx="0" cy="2" rx="42" ry="3.5" fill="#cfe6f3" opacity=".55" />
            <path d="M -10,-2 L 0,-32 L 10,-2 Z" fill="#1c2a36" />
            <path d="M -5,-6 L 0,-26 L 5,-6 Z" fill="#3a4a55" />
          </g>
          {/* Right shark — medium */}
          <g transform="translate(560, 352)">
            <ellipse cx="0" cy="2" rx="34" ry="3" fill="#cfe6f3" opacity=".5" />
            <path d="M -8,-2 L 0,-26 L 8,-2 Z" fill="#1c2a36" />
            <path d="M -4,-4 L 0,-22 L 4,-4 Z" fill="#3a4a55" />
          </g>
          {/* Far shark — small, behind the atoll */}
          <g transform="translate(280, 280)">
            <ellipse cx="0" cy="1" rx="14" ry="1.5" fill="#cfe6f3" opacity=".35" />
            <path d="M -4,-1 L 0,-12 L 4,-1 Z" fill="#1c2a36" opacity=".85" />
          </g>
          {/* Far shark 2 — to the right */}
          <g transform="translate(530, 274)">
            <ellipse cx="0" cy="1" rx="12" ry="1.4" fill="#cfe6f3" opacity=".3" />
            <path d="M -3.5,-1 L 0,-10 L 3.5,-1 Z" fill="#1c2a36" opacity=".75" />
          </g>
        </svg>
      </div>

      {/* Vignette to focus the eye on the title + CTA */}
      <div className="ts-splash__vignette" />

      <div className="ts-splash__content">
        <h1 className="ts-splash__title">
          <span className="ts-splash__title-emph">Tidal</span>
          <span className="ts-splash__title-emph ts-splash__title-emph--accent">Survive</span>
        </h1>
        <p className="ts-splash__subtitle">{t('subtitle')}</p>

        {highScore > 0 && (
          <div className="ts-splash__best">
            <span className="ts-splash__best-label">BEST</span>
            <span className="ts-splash__best-value">{highScore}</span>
          </div>
        )}

        <button className="ts-splash__cta" onPointerDown={onStart}>
          <span className="ts-splash__cta-text">{t('tap_to_start')}</span>
          <span className="ts-splash__cta-pulse" aria-hidden />
        </button>
      </div>
    </div>
  );
}
