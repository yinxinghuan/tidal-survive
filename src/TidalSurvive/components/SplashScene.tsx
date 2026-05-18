// Pure SVG/CSS splash. No 3D Canvas → safe to mount during Aigram preload.
// Stormy ocean horizon + a tiny island silhouette with one figure on it.
import { useState } from 'react';
import { t } from '../i18n';

interface Wave {
  id: number;
  top: number;      // %
  delay: number;
  duration: number;
  opacity: number;
}

export function SplashScene({ onStart, highScore }: { onStart: () => void; highScore: number }) {
  // A handful of horizontal "wave" streaks that drift across the screen.
  const [waves] = useState<Wave[]>(() =>
    Array.from({ length: 14 }, (_, i) => ({
      id: i,
      top: 38 + Math.random() * 50,
      delay: -Math.random() * 12,
      duration: 8 + Math.random() * 10,
      opacity: 0.15 + Math.random() * 0.4,
    }))
  );

  return (
    <div className="ts-splash">
      {/* Sky gradient — dusk over open sea */}
      <div className="ts-splash__sky" />
      <div className="ts-splash__sun" />

      {/* Wave streaks */}
      <div className="ts-splash__waves">
        {waves.map(w => (
          <div
            key={w.id}
            className="ts-splash__wave"
            style={{
              top: `${w.top}%`,
              opacity: w.opacity,
              animationDelay: `${w.delay}s`,
              animationDuration: `${w.duration}s`,
            }}
          />
        ))}
      </div>

      {/* Island silhouette layer */}
      <div className="ts-splash__island">
        <svg viewBox="0 0 800 260" preserveAspectRatio="none" width="100%" height="100%">
          {/* Ripple line behind the island */}
          <ellipse cx="400" cy="222" rx="240" ry="9" fill="#0c1a2a" opacity=".7" />
          <ellipse cx="400" cy="226" rx="260" ry="6" fill="#0c1a2a" opacity=".45" />

          {/* Island base (sand) */}
          <path
            d="M 220,222 Q 280,200 360,198 Q 440,196 510,202 Q 580,210 590,222 Z"
            fill="#6d5a3a"
            opacity=".95"
          />
          <path
            d="M 240,218 Q 300,200 380,198 Q 460,198 530,206 Q 575,214 580,220 Z"
            fill="#c69c5e"
          />
          <path
            d="M 260,214 Q 320,202 400,200 Q 470,200 530,208 Z"
            fill="#e6cf9c"
          />

          {/* Tiny rock stack center-left */}
          <rect x="354" y="180" width="14" height="18" rx="3" fill="#56504a" />
          <rect x="350" y="172" width="22" height="10" rx="3" fill="#7a7068" />

          {/* Sailor silhouette — bright orange jacket so it pops */}
          <g transform="translate(415, 170)">
            <rect x="-4" y="14" width="8" height="14" fill="#21314a" />
            <rect x="-8" y="2" width="16" height="14" rx="3" fill="#ff8b3a" />
            <rect x="-9" y="6" width="18" height="3" fill="#c25e1c" />
            <circle cx="0" cy="-3" r="5.4" fill="#f0c9a3" />
            <rect x="-6" y="-9" width="12" height="3" rx="1" fill="#f6f7fa" />
            <rect x="-7" y="-7" width="14" height="2" fill="#1b2a40" />
          </g>

          {/* Shark fin in the foreground water — small black triangle */}
          <polygon points="160,236 152,224 144,236" fill="#1c2a36" />
          <polygon points="640,240 648,228 656,240" fill="#1c2a36" />
        </svg>
      </div>

      {/* Foreground gradient haze for vignette */}
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
