type Locale = 'zh' | 'en';

function detectLocale(): Locale {
  const override = localStorage.getItem('game_locale');
  if (override === 'en' || override === 'zh') return override;
  return 'en';
}

const dict: Record<Locale, Record<string, string>> = {
  zh: {
    title: 'Tidal Survive',
    subtitle: '潮水涨落，建材随浪漂来。垒高、活下去。',
    tap_to_start: '开始求生',
    again: '再来一次',
    score: '得分',
    high: '最高',
    leaderboard: '排行榜',
    drowned: '被潮水淹没',
    eaten: '被鲨鱼咬死',
    survived: '存活 {n} 秒',
    rule_collect: '走到木板/巨石上自动捡起',
    rule_drop:    '回到脚下的格子自动放下，垒高它',
    rule_dodge:   '入水超过 2 秒，鲨鱼就来',
    tut_move:     '拖动屏幕任意位置开始移动',
    tut_pickup:   '木板正漂过来 — 走过去自动捡起',
    tut_drop:     '走到金光柱位置，轻点屏幕放下',
    tut_tide:     '潮水正在上涨 — 垒高才能活下去',
  },
  en: {
    title: 'Tidal Survive',
    subtitle: 'TIDES RISE AND EBB · DEBRIS DRIFTS IN · STACK UP',
    tap_to_start: 'Start',
    again: 'Try again',
    score: 'Score',
    high: 'Best',
    leaderboard: 'Leaderboard',
    drowned: 'DROWNED',
    eaten: 'EATEN BY SHARK',
    survived: 'SURVIVED {n}s',
    rule_collect: 'Walk over plank / boulder to pick up',
    rule_drop:    'Drop on your tile to raise its height',
    rule_dodge:   '2s in water → shark bite',
    tut_move:     'DRAG ANYWHERE TO MOVE',
    tut_pickup:   'A PLANK IS DRIFTING IN — WALK TO IT',
    tut_drop:     'WALK TO THE BEACON · TAP TO DROP',
    tut_tide:     'WATER IS RISING — STACK TO STAY DRY',
  },
};

let cur: Locale = detectLocale();

export function setLocale(l: Locale) {
  cur = l;
  localStorage.setItem('game_locale', l);
}

export function t(key: string, vars?: { n?: number | string }): string {
  const raw = dict[cur][key] ?? dict.en[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k) => String((vars as any)[k] ?? ''));
}

export function getLocale(): Locale { return cur; }
