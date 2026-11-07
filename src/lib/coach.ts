/** Coach notes: rule-based observations comparing one player to their team and lobby. */
export interface CoachPlayer {
  account_id: number; team: number; hero_id: number;
  kills: number; deaths: number; assists: number; net_worth: number; last_hits: number; denies: number;
  stats: Partial<Record<string, number | unknown>>[];
}

export interface CoachNote { id: string; tone: "good" | "bad"; title: string; text: string }

const last = (p: CoachPlayer, k: string) => { const v = p.stats.at(-1)?.[k]; return typeof v === "number" ? v : 0; };
const sum = (ps: CoachPlayer[], f: (p: CoachPlayer) => number) => ps.reduce((s, p) => s + f(p), 0);
const avg = (ps: CoachPlayer[], f: (p: CoachPlayer) => number) => (ps.length ? sum(ps, f) / ps.length : 0);
const pct = (v: number) => `${Math.round(v)}%`;

export function coachNotes(p: CoachPlayer, lobby: CoachPlayer[], durationS: number, winner: number): CoachNote[] {
  const team = lobby.filter((x) => x.team === p.team);
  const enemies = lobby.filter((x) => x.team !== p.team);
  const mins = Math.max(1, durationS / 60);
  const notes: CoachNote[] = [];

  // Deaths share
  const teamDeaths = sum(team, (x) => x.deaths);
  const deathShare = teamDeaths ? (p.deaths / teamDeaths) * 100 : 0;
  if (p.deaths >= 5 && deathShare >= 30) notes.push({ id: "deaths", tone: "bad", title: "Слишком много смертей", text: `${p.deaths} смертей — ${pct(deathShare)} от всех смертей команды. Каждая смерть отдаёт души и время карты: держитесь ближе к союзникам и отступайте раньше.` });
  else if (p.deaths <= 2 && durationS >= 1200) notes.push({ id: "deaths", tone: "good", title: "Аккуратная игра", text: `Всего ${p.deaths} смертей за ${Math.round(mins)} минут — команда почти не теряла вас из боёв.` });

  // Objective damage
  const teamObj = sum(team, (x) => last(x, "boss_damage"));
  const objShare = teamObj ? (last(p, "boss_damage") / teamObj) * 100 : 0;
  if (teamObj > 0 && objShare < 8) notes.push({ id: "objectives", tone: "bad", title: "Мало урона по объектам", text: `Ваш урон по Стражам, постройкам и боссу — ${pct(objShare)} от команды. После выигранного боя переключайтесь на пуш: объекты решают матч.` });
  else if (objShare >= 30) notes.push({ id: "objectives", tone: "good", title: "Главный разрушитель", text: `${pct(objShare)} урона команды по объектам — именно вы двигали карту.` });

  // Farm per minute vs lobby
  const lh = p.last_hits / mins, lobbyLh = avg(lobby, (x) => x.last_hits / mins);
  if (lobbyLh > 0 && lh < lobbyLh * 0.7) notes.push({ id: "farm", tone: "bad", title: "Отставание по фарму", text: `${lh.toFixed(1)} крипа в минуту против ${lobbyLh.toFixed(1)} в среднем по лобби. Забирайте волны и лагеря между боями.` });
  else if (lobbyLh > 0 && lh > lobbyLh * 1.3) notes.push({ id: "farm", tone: "good", title: "Отличный фарм", text: `${lh.toFixed(1)} крипа в минуту — на ${pct((lh / lobbyLh - 1) * 100)} выше среднего лобби.` });

  // Damage efficiency per soul
  const dmg = last(p, "player_damage");
  const eff = p.net_worth ? dmg / p.net_worth : 0;
  const lobbyEff = avg(lobby, (x) => (x.net_worth ? last(x, "player_damage") / x.net_worth : 0));
  if (lobbyEff > 0 && p.net_worth > 0 && eff < lobbyEff * 0.65) notes.push({ id: "efficiency", tone: "bad", title: "Души не превращаются в урон", text: `${eff.toFixed(2)} урона на душу при среднем ${lobbyEff.toFixed(2)}. Больше времени в боях или предметы на урон помогут реализовать преимущество.` });
  else if (lobbyEff > 0 && eff > lobbyEff * 1.4) notes.push({ id: "efficiency", tone: "good", title: "Эффективный урон", text: `${eff.toFixed(2)} урона на каждую душу — заметно выше лобби (${lobbyEff.toFixed(2)}).` });

  // Accuracy
  const shots = last(p, "shots_hit") + last(p, "shots_missed");
  const acc = shots ? (last(p, "shots_hit") / shots) * 100 : 0;
  const lobbyAcc = avg(lobby.filter((x) => last(x, "shots_hit") + last(x, "shots_missed") > 0), (x) => (last(x, "shots_hit") / (last(x, "shots_hit") + last(x, "shots_missed"))) * 100);
  if (shots >= 300 && lobbyAcc > 0 && acc < lobbyAcc - 8) notes.push({ id: "aim", tone: "bad", title: "Низкая точность", text: `${pct(acc)} попаданий при ${pct(lobbyAcc)} в лобби. Стреляйте короткими очередями и ближе к цели.` });

  // Anti-heal: enemies heal a lot, player had no healing reduction in kills? We only know heal_prevented.
  const enemyHeal = sum(enemies, (x) => last(x, "player_healing") + last(x, "self_healing"));
  const teamPrevented = sum(team, (x) => last(x, "heal_prevented"));
  if (enemyHeal > 20000 && teamPrevented < enemyHeal * 0.05) notes.push({ id: "antiheal", tone: "bad", title: "Нужен антихил", text: `Соперники вылечили ${Math.round(enemyHeal / 1000)}k здоровья, а ваша команда почти ничего не срезала. Toxic Bullets, Decay или Healbane окупятся.` });

  // Gold lost on deaths
  const lost = last(p, "gold_death_loss");
  if (p.net_worth > 0 && lost / p.net_worth > 0.15) notes.push({ id: "souls", tone: "bad", title: "Потеря душ при смертях", text: `Вы потеряли ${Math.round(lost / 1000)}k душ на смертях — ${pct((lost / p.net_worth) * 100)} от заработанного. Тратьте души перед рискованными заходами.` });

  // Kill participation
  const teamKills = sum(team, (x) => x.kills);
  const kp = teamKills ? ((p.kills + p.assists) / teamKills) * 100 : 0;
  if (teamKills >= 10 && kp >= 70) notes.push({ id: "kp", tone: "good", title: "В каждом бою", text: `Участие в ${pct(kp)} убийств команды.` });
  else if (teamKills >= 10 && kp < 35) notes.push({ id: "kp", tone: "bad", title: "Далеко от боёв", text: `Участие лишь в ${pct(kp)} убийств команды. Следите за мини-картой и подтягивайтесь к драке.` });

  if (p.team !== winner && !notes.some((n) => n.tone === "bad")) notes.push({ id: "team", tone: "good", title: "Не ваша вина", text: "Явных личных ошибок не видно — поражение больше связано с командой." });
  return notes;
}
