import fs from 'node:fs';
import path from 'node:path';

const CLIENT_ID = process.env.VITE_TWITCH_CLIENT_ID || 'muzb5q78l17kzic1e12opxdbgcrfgc';
const CLIENT_SECRET = process.env.VITE_TWITCH_CLIENT_SECRET || 'w6ikcxlj7qwcram1o5rxrxocnjofyk';

const IGDB_GENRE_PT = {
  'Role-playing (RPG)': 'RPG',
  Adventure: 'Aventura',
  Shooter: 'Tiro / Shooter',
  Fighting: 'Luta',
  Platform: 'Plataforma',
  Puzzle: 'Puzzle',
  Racing: 'Corrida',
  'Real Time Strategy (RTS)': 'Estratégia (RTS)',
  Simulator: 'Simulador',
  Sport: 'Esporte',
  Strategy: 'Estratégia',
  'Turn-based strategy (TBS)': 'Estratégia por Turnos',
  Tactical: 'Tático',
  "Hack and slash/Beat 'em up": 'Hack and Slash',
  Indie: 'Indie',
  Arcade: 'Arcade',
  'Card & Board Game': 'Cartas & Tabuleiro',
  MOBA: 'MOBA',
  'Point-and-click': 'Point-and-Click',
  Music: 'Música',
  'Visual Novel': 'Visual Novel',
};

function unixToIsoDate(unixSeconds) {
  if (!unixSeconds || typeof unixSeconds !== 'number') return null;
  const d = new Date(unixSeconds * 1000);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function postIgdb(endpoint, query, token) {
  const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: 'POST',
    headers: {
      'Client-ID': CLIENT_ID,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'text/plain',
    },
    body: query,
  });
  if (!res.ok) {
    throw new Error(`IGDB ${endpoint} status ${res.status}`);
  }
  return res.json();
}

async function main() {
  console.log('🎮 Autenticando na Twitch OAuth2 para sincronizar jogos da IGDB...');
  try {
    const tokenUrl = `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(
      CLIENT_ID
    )}&client_secret=${encodeURIComponent(
      CLIENT_SECRET
    )}&grant_type=client_credentials`;

    const tokenRes = await fetch(tokenUrl, { method: 'POST' });
    if (!tokenRes.ok) {
      console.warn('⚠️ Não foi possível obter token da Twitch no momento:', tokenRes.status);
      return;
    }

    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;
    if (!token) {
      console.warn('⚠️ Token da Twitch vazio.');
      return;
    }

    const now = new Date();
    const todayStartUnix = Math.floor(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0) / 1000
    );
    const yesterdayEndUnix = todayStartUnix - 1;
    const futureLimitUnix = todayStartUnix + 365 * 86400;
    const pastLimitUnix = todayStartUnix - 365 * 86400;

    const upcomingQuery = `
      fields id, name, summary, storyline, first_release_date, total_rating, rating, total_rating_count, hypes, follows, cover.image_id, screenshots.image_id, genres.name, platforms.name, platforms.abbreviation, involved_companies.company.name, involved_companies.developer;
      where first_release_date >= ${todayStartUnix} & first_release_date <= ${futureLimitUnix} & cover != null & version_parent = null;
      sort first_release_date asc;
      limit 70;
    `;

    const upcomingHypedOneYearQuery = `
      fields id, name, summary, storyline, first_release_date, total_rating, rating, total_rating_count, hypes, follows, cover.image_id, screenshots.image_id, genres.name, platforms.name, platforms.abbreviation, involved_companies.company.name, involved_companies.developer;
      where first_release_date >= ${todayStartUnix} & first_release_date <= ${futureLimitUnix} & cover != null & version_parent = null & (hypes > 0 | follows > 0);
      sort hypes desc;
      limit 100;
    `;

    const pastQuery = `
      fields id, name, summary, storyline, first_release_date, total_rating, rating, total_rating_count, hypes, follows, cover.image_id, screenshots.image_id, genres.name, platforms.name, platforms.abbreviation, involved_companies.company.name, involved_companies.developer;
      where first_release_date <= ${yesterdayEndUnix} & first_release_date >= ${pastLimitUnix} & cover != null & version_parent = null;
      sort first_release_date desc;
      limit 100;
    `;

    const [upcomingRaw, upcomingHypedRaw, pastRaw] = await Promise.all([
      postIgdb('games', upcomingQuery, token),
      postIgdb('games', upcomingHypedOneYearQuery, token),
      postIgdb('games', pastQuery, token),
    ]);

    const combinedRaw = [
      ...(pastRaw || []),
      ...(upcomingRaw || []),
      ...(upcomingHypedRaw || []),
    ].filter(
      (g) => g && g.id && g.first_release_date
    );

    console.log(
      `✅ IGDB retornou ${pastRaw?.length || 0} jogos lançados anteriormente e ${
        upcomingRaw?.length || 0
      } próximos lançamentos!`
    );

    const gameIds = [...new Set(combinedRaw.map((g) => g.id))].slice(0, 150);
    const ttbMap = new Map();

    if (gameIds.length > 0) {
      try {
        const ttbQuery = `fields game_id, hastily, normally, completely; where game_id = (${gameIds.join(
          ','
        )}); limit 150;`;
        const ttbList = await postIgdb('game_time_to_beats', ttbQuery, token);
        for (const ttb of ttbList || []) {
          if (ttb?.game_id) ttbMap.set(ttb.game_id, ttb);
        }
      } catch {
        // Ignore time_to_beat error
      }
    }

    const seen = new Set();
    const mappedItems = [];

    for (const g of combinedRaw) {
      const extId = String(g.id);
      if (seen.has(extId)) continue;
      seen.add(extId);

      const coverImageId = g.cover?.image_id;
      const posterUrl = coverImageId
        ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${coverImageId}.jpg`
        : 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=85';

      const screenImageId = g.screenshots?.[0]?.image_id;
      const backdropUrl = screenImageId
        ? `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${screenImageId}.jpg`
        : coverImageId
        ? `https://images.igdb.com/igdb/image/upload/t_720p/${coverImageId}.jpg`
        : undefined;

      const devEntry =
        g.involved_companies?.find((ic) => ic.developer && ic.company?.name) ||
        g.involved_companies?.find((ic) => ic.company?.name);
      const developer = devEntry?.company?.name || 'Estúdio Oficial (IGDB)';

      const platforms = (g.platforms || [])
        .map((p) => p.abbreviation || p.name)
        .filter(Boolean)
        .slice(0, 5);

      const genres = (g.genres || [])
        .map((gen) => IGDB_GENRE_PT[gen.name] || gen.name)
        .slice(0, 4);

      const rawRating = g.total_rating ?? g.rating;
      const rating =
        typeof rawRating === 'number' && rawRating > 0
          ? Math.round((rawRating / 10) * 10) / 10
          : undefined;

      const reviewsCount =
        (g.total_rating_count || 0) * 25 +
        (g.hypes || 0) * 180 +
        (g.follows || 0) * 90 +
        1800;

      const ttb = ttbMap.get(g.id);
      const mainHours =
        ttb?.normally && ttb.normally > 0
          ? Math.max(1, Math.round(ttb.normally / 3600))
          : null;
      const extraHours =
        ttb?.normally && ttb?.completely
          ? Math.max(1, Math.round((ttb.normally + ttb.completely) / 2 / 3600))
          : ttb?.hastily
          ? Math.max(1, Math.round(ttb.hastily / 3600))
          : null;
      const completionistHours =
        ttb?.completely && ttb.completely > 0
          ? Math.max(1, Math.round(ttb.completely / 3600))
          : null;

      const hltbLabel = mainHours
        ? `~${mainHours}h para zerar`
        : completionistHours
        ? `~${completionistHours}h (100%)`
        : 'Tempo: Aguardando dados';

      mappedItems.push({
        id: `igdb-game-${g.id}`,
        externalId: extId,
        category: 'game',
        title: g.name,
        originalTitle: g.name,
        posterUrl,
        backdropUrl,
        synopsis:
          g.summary ||
          g.storyline ||
          'Acompanhe o lançamento deste jogo confirmado na base oficial da Twitch / IGDB.',
        genres: genres.length > 0 ? genres : ['Games'],
        rating,
        reviewsCount,
        developer,
        platforms: platforms.length > 0 ? platforms : ['PC', 'PS5', 'Xbox Series'],
        releaseDate: unixToIsoDate(g.first_release_date),
        hltbMainHours: mainHours,
        hltbExtraHours: extraHours,
        hltbCompletionistHours: completionistHours,
        hltbLabel,
      });
    }

    if (mappedItems.length > 0) {
      const outPath = path.resolve(process.cwd(), 'public', 'igdb-cache.json');
      fs.writeFileSync(outPath, JSON.stringify(mappedItems, null, 2), 'utf-8');
      console.log(`💾 Salvos ${mappedItems.length} jogos reais da Twitch/IGDB em public/igdb-cache.json!`);
    }
  } catch (err) {
    console.warn('⚠️ Aviso ao sincronizar IGDB:', err.message);
  }
}

main();
