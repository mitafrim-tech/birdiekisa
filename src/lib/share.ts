// WhatsApp share message builder (Finnish)

export interface RoundSummary {
  course_name: string;
  played_on: string;
  birdies: number;
  eagles: number;
  albatrosses: number;
  hole_in_ones: number;
  player_nickname: string;
  team_name: string;
  app_url: string;
}

function pluralBirdie(n: number) {
  return n === 1 ? "birdie" : "birdiet";
}

export function buildWhatsAppMessage(s: RoundSummary): string {
  const parts: string[] = [];
  const big = s.hole_in_ones + s.albatrosses + s.eagles;

  if (s.hole_in_ones > 0) {
    parts.push(`🎉⛳ HOLARI! ${s.player_nickname} teki holarin @ ${s.course_name}!`);
  } else if (s.albatrosses > 0) {
    parts.push(`🪶 ALBATROSS! ${s.player_nickname} kirjasi albatrossin @ ${s.course_name}!`);
  } else if (s.eagles > 0) {
    parts.push(`🦅 EAGLE! ${s.player_nickname} pamautti eaglen @ ${s.course_name}.`);
  } else if (s.birdies > 0) {
    parts.push(`🐦 ${s.player_nickname} kirjasi ${s.birdies} ${pluralBirdie(s.birdies)} @ ${s.course_name}.`);
  } else {
    parts.push(`⛳ ${s.player_nickname} pelasi kierroksen @ ${s.course_name}.`);
  }

  // Stat line
  const stats: string[] = [];
  if (s.birdies > 0) stats.push(`${s.birdies} birdie${s.birdies === 1 ? "" : "ä"}`);
  if (s.eagles > 0) stats.push(`${s.eagles} eagle${s.eagles === 1 ? "" : "a"}`);
  if (s.albatrosses > 0) stats.push(`${s.albatrosses} albatross${s.albatrosses === 1 ? "" : "ia"}`);
  if (s.hole_in_ones > 0) stats.push(`${s.hole_in_ones} holari${s.hole_in_ones === 1 ? "" : "a"}`);
  if (stats.length > 0 && big > 0 && s.birdies > 0) {
    parts.push(`Lisäksi: ${stats.filter(x => !x.includes(big > 0 ? "" : "")).join(", ")}`);
  } else if (stats.length > 1) {
    parts.push(`Yhteensä: ${stats.join(", ")}.`);
  }

  parts.push(`\n🏆 ${s.team_name} – tulostaulu: ${s.app_url}`);
  return parts.join("\n");
}

export function openWhatsAppShare(message: string) {
  const encoded = encodeURIComponent(message);
  // wa.me opens chat picker on mobile, Web WhatsApp on desktop
  const url = `https://wa.me/?text=${encoded}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
