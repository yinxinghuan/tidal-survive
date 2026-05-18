import { t } from '../i18n';
import './Tutorial.less';

/**
 * First-play tutorial overlay. 4 steps:
 *   move    — drag joystick to move (touch_app finger animation)
 *   pickup  — walk onto the highlighted plank
 *   drop    — walk to the cone-marked tile to drop
 *   tide    — point at tide bar; "WATER IS RISING"
 *
 * Game loop pauses the tide clock until step transitions to 'done'.
 */
export function Tutorial({ step }: { step: 'move' | 'pickup' | 'drop' | 'tide' }) {
  return (
    <div className={`ts-tut ts-tut--${step}`}>
      {step === 'move' && (
        <>
          <div className="ts-tut__finger">
            <svg viewBox="0 0 24 24" width="64" height="64" fill="#fff" aria-hidden>
              {/* Google Material `touch_app` icon */}
              <path d="M9 11.24V7.5a2.5 2.5 0 0 1 5 0v3.74a6 6 0 1 0-5 0Zm9.84 4.63-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6a1.5 1.5 0 1 0-3 0v10.74l-3.44-.72a1.42 1.42 0 0 0-1.41 2.41l4.62 4.62c.28.28.66.44 1.06.44h6.79c.75 0 1.38-.55 1.49-1.29l.72-5.07a1.512 1.512 0 0 0-.99-1.76Z"/>
            </svg>
          </div>
          <div className="ts-tut__caption">{t('tut_move')}</div>
        </>
      )}
      {step === 'pickup' && (
        <div className="ts-tut__caption ts-tut__caption--top">{t('tut_pickup')}</div>
      )}
      {step === 'drop' && (
        <div className="ts-tut__caption ts-tut__caption--top">{t('tut_drop')}</div>
      )}
      {step === 'tide' && (
        <div className="ts-tut__caption ts-tut__caption--bottom">{t('tut_tide')}</div>
      )}
    </div>
  );
}
