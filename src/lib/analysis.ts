export interface StatSnap {
  time_stamp_s: number;
  net_worth: number;
  kills: number;
  deaths: number;
  assists: number;
  creep_kills: number;
  possible_creeps: number;
  denies: number;
  player_damage: number;
  player_healing: number;
  player_damage_taken: number;
  shots_hit: number;
  shots_missed: number;
  level?: number;
}
export interface APlayer {
  account_id: number;
  team: number;
  hero_id: number;
  assigned_lane: number;
  kills: number;
  deaths: number;
  assists: number;
  net_worth: number;
  last_hits: number;
  denies: number;
  stats: StatSnap[];
}

export const LANE_NAMES: Record<number, string> = { 1: "Жёлтая линия", 4: "Синяя линия", 6: "Зелёная линия" };
export const LANE_TIME = 540; // 9 минута

/** Snapshot closest to (and not after, if possible) time t */
export function snapAt(p: APlayer, t: number): StatSnap | undefined {
  if (!p.stats.length) return undefined;
  let best = p.stats[0];
  for (const s of p.stats) if (s.time_stamp_s <= t) best = s;
  return best;
}

export interface LaneResult {
  lane: number;
  team0: APlayer[];
  team1: APlayer[];
  souls0: number;
  souls1: number;
  diff: number; // team0 - team1
  winner: 0 | 1 | null;
}

export function laneResults(players: APlayer[], t = LANE_TIME): LaneResult[] {
  const lanes = [...new Set(players.map((p) => p.assigned_lane))].filter(Boolean).sort((a, b) => a - b);
  return lanes.map((lane) => {
    const team0 = players.filter((p) => p.assigned_lane === lane && p.team === 0);
    const team1 = players.filter((p) => p.assigned_lane === lane && p.team === 1);
    const sum = (arr: APlayer[]) => arr.reduce((s, p) => s + (snapAt(p, t)?.net_worth ?? 0), 0);
    const souls0 = sum(team0);
    const souls1 = sum(team1);
    const diff = souls0 - souls1;
    const total = Math.max(1, souls0 + souls1);
    const winner = Math.abs(diff) / total < 0.03 ? null : diff > 0 ? 0 : 1;
    return { lane, team0, team1, souls0, souls1, diff, winner };
  });
}

/** Team net worth advantage over time (team0 - team1) */
export function advantageSeries(players: APlayer[]) {
  const times = [...new Set(players.flatMap((p) => p.stats.map((s) => s.time_stamp_s)))].sort((a, b) => a - b);
  return [{ t: 0, diff: 0 }, ...times.map((t) => {
    let d = 0;
    for (const p of players) {
      const s = p.stats.find((x) => x.time_stamp_s === t) ?? snapAt(p, t);
      d += (p.team === 0 ? 1 : -1) * (s?.net_worth ?? 0);
    }
    return { t, diff: d };
  })];
}

export type Tone = "good" | "bad" | "info";
export interface Tip {
  tone: Tone;
  title: string;
  text: string;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function playerTips(p: APlayer, all: APlayer[], durationS: number): Tip[] {
  const tips: Tip[] = [];
  const last = p.stats.at(-1);
  const minutes = Math.max(1, durationS / 60);

  // Lane
  const lane = laneResults(all).find((l) => l.lane === p.assigned_lane);
  const opps = all.filter((x) => x.assigned_lane === p.assigned_lane && x.team !== p.team);
  const mine = snapAt(p, LANE_TIME)?.net_worth ?? 0;
  if (opps.length) {
    const oppAvg = opps.reduce((s, o) => s + (snapAt(o, LANE_TIME)?.net_worth ?? 0), 0) / opps.length;
    const d = mine - oppAvg;
    if (d < -1000)
      tips.push({ tone: "bad", title: "Проигранная линия", text: `К 9-й минуте у вас на ${Math.round(-d)} душ меньше, чем в среднем у соперников по линии. Играйте осторожнее, фокусируйтесь на добивании крипов и вовремя отходите.` });
    else if (d > 1000)
      tips.push({ tone: "good", title: "Сильная линия", text: `Вы опередили соперников по линии на ${Math.round(d)} душ к 9-й минуте. Используйте преимущество — помогайте соседним линиям.` });
    else if (lane) tips.push({ tone: "info", title: "Ровная линия", text: "Линия прошла примерно на равных. Решающими станут ротации и объекты." });
  }

  if (last) {
    // Farm efficiency
    if (last.possible_creeps > 0) {
      const eff = last.creep_kills / last.possible_creeps;
      if (eff < 0.5) tips.push({ tone: "bad", title: "Низкое добивание", text: `Вы забрали лишь ${pct(eff)} доступных крипов. Отрабатывайте добивание и не забывайте подбирать сферы душ.` });
      else if (eff > 0.7) tips.push({ tone: "good", title: "Отличный фарм", text: `${pct(eff)} доступных крипов добито — превосходная эффективность.` });
    }
    // Accuracy
    const shots = last.shots_hit + last.shots_missed;
    if (shots > 200) {
      const acc = last.shots_hit / shots;
      if (acc < 0.35) tips.push({ tone: "bad", title: "Низкая точность", text: `Точность стрельбы ${pct(acc)}. Попробуйте стрелять короткими очередями и держать прицел на уровне головы.` });
      else if (acc > 0.55) tips.push({ tone: "good", title: "Меткая стрельба", text: `Точность ${pct(acc)} — выше большинства игроков.` });
    }
    // Damage taken vs dealt
    if (last.player_damage_taken > last.player_damage * 1.5 && p.deaths >= 5)
      tips.push({ tone: "bad", title: "Много получаемого урона", text: "Вы получили значительно больше урона, чем нанесли. Подумайте о предметах живучести и позиционировании за спинами союзников." });
  }

  // Denies
  const dpm10 = (p.denies / minutes) * 10;
  if (dpm10 < 2) tips.push({ tone: "bad", title: "Мало денаев", text: `Всего ${p.denies} денаев за матч. Добивание своих сфер душ лишает соперника золота и даёт преимущество на линии.` });

  // Deaths
  const dpm = p.deaths / minutes;
  if (dpm > 0.3) tips.push({ tone: "bad", title: "Частые смерти", text: `${p.deaths} смертей — это примерно одна каждые ${Math.round(1 / dpm)} мин. Каждая смерть отдаёт сопернику души и время.` });
  else if (p.deaths <= 2 && minutes > 20) tips.push({ tone: "good", title: "Аккуратная игра", text: `Всего ${p.deaths} смерт${p.deaths === 1 ? "ь" : "и"} за ${Math.round(minutes)} минут.` });

  // Net worth vs match average
  const avgNw = all.reduce((s, x) => s + x.net_worth, 0) / Math.max(1, all.length);
  if (p.net_worth < avgNw * 0.8) tips.push({ tone: "bad", title: "Отставание по душам", text: `Итоговые души на ${pct(1 - p.net_worth / avgNw)} ниже среднего в матче. Фармите лагеря нейтралов между драками.` });
  else if (p.net_worth > avgNw * 1.2) tips.push({ tone: "good", title: "Лидер по душам", text: `Души на ${pct(p.net_worth / avgNw - 1)} выше среднего по матчу.` });

  // Kill participation
  const teamKills = all.filter((x) => x.team === p.team).reduce((s, x) => s + x.kills, 0);
  if (teamKills > 10) {
    const kp = (p.kills + p.assists) / teamKills;
    if (kp < 0.35) tips.push({ tone: "bad", title: "Низкое участие в драках", text: `Участие в убийствах команды — ${pct(kp)}. Чаще присоединяйтесь к командным схваткам.` });
    else if (kp > 0.65) tips.push({ tone: "good", title: "Командный игрок", text: `Участие в убийствах — ${pct(kp)}.` });
  }

  return tips;
}
