// 개인화 게임 추천 — 순수 함수로만 구성 (React/Supabase 의존 없음).
// 웹/모바일에서 동일하게 재사용하기 위해 이 파일은 games/reviews 배열만 입력받는다.

const GENRE_WEIGHT = 0.5;
const PLAYER_WEIGHT = 0.2;
const TIME_WEIGHT = 0.15;
const QUALITY_WEIGHT = 0.15;

const TIME_FALLOFF_MINUTES = 60; // 이 이상 차이나면 시간 점수 0
const MAX_PER_GENRE = 5;         // 추천 목록 내 동일 장르 상한
const DEFAULT_RESULT_COUNT = 10;
const LIKED_THRESHOLD = 4;       // 이 점수 이상을 "좋아한 게임"으로 취급
export const MIN_REVIEWS_FOR_RECOMMENDATION = 3;

function resolveGame(review, gamesById) {
  return review.games || gamesById[review.game_id] || null;
}

// reviews: [{ game_id, total_score, games? }] — games는 embedded join이면 그대로 쓰고,
// 없으면 gamesById에서 game_id로 찾는다.
export function buildTasteProfile(reviews, gamesById = {}) {
  const allReviews = reviews || [];
  const rated = allReviews.filter((r) => r.total_score != null);
  const likedGames = rated
    .filter((r) => r.total_score >= LIKED_THRESHOLD)
    .map((r) => resolveGame(r, gamesById))
    .filter(Boolean);

  const genreCounts = {};
  likedGames.forEach((g) => {
    (g.genre || []).forEach((genre) => {
      genreCounts[genre] = (genreCounts[genre] || 0) + 1;
    });
  });
  const maxGenreCount = Object.values(genreCounts).reduce((m, c) => Math.max(m, c), 0);
  const genreWeights = {};
  Object.entries(genreCounts).forEach(([genre, count]) => {
    genreWeights[genre] = maxGenreCount > 0 ? count / maxGenreCount : 0;
  });
  const topGenres = Object.entries(genreWeights)
    .sort((a, b) => b[1] - a[1])
    .map(([genre]) => genre);

  // 선호 인원: 좋아한 게임들의 [min_players, max_players] 구간을 전부 펼쳐서 최빈값을 찾는다.
  const playerFreq = {};
  likedGames.forEach((g) => {
    const min = g.min_players;
    const max = g.max_players ?? min;
    if (min == null) return;
    for (let n = min; n <= max; n++) {
      playerFreq[n] = (playerFreq[n] || 0) + 1;
    }
  });
  let preferredPlayers = null;
  let bestPlayerCount = -1;
  Object.entries(playerFreq).forEach(([n, count]) => {
    if (count > bestPlayerCount) {
      bestPlayerCount = count;
      preferredPlayers = Number(n);
    }
  });

  const times = likedGames.map((g) => g.play_minutes).filter((t) => t != null);
  const preferredMinutes = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : null;

  const avgScore = rated.length > 0
    ? rated.reduce((sum, r) => sum + r.total_score, 0) / rated.length
    : null;

  return {
    reviewCount: allReviews.length,
    ratedCount: rated.length,
    genreWeights,
    topGenres,
    preferredPlayers,
    preferredMinutes,
    avgScore,
  };
}

export function isEligibleForRecommendation(profile) {
  return !!profile && profile.reviewCount >= MIN_REVIEWS_FOR_RECOMMENDATION;
}

function scoreGenre(genres, genreWeights) {
  if (!genres || genres.length === 0) return 0;
  const sum = genres.reduce((total, g) => total + (genreWeights[g] || 0), 0);
  return sum / genres.length;
}

function scorePlayers(game, preferredPlayers) {
  if (preferredPlayers == null || game.min_players == null) return 0.5;
  const max = game.max_players ?? game.min_players;
  return preferredPlayers >= game.min_players && preferredPlayers <= max ? 1 : 0;
}

function scoreTime(game, preferredMinutes) {
  if (preferredMinutes == null || game.play_minutes == null) return 0.5;
  const diff = Math.abs(game.play_minutes - preferredMinutes);
  return Math.max(0, 1 - diff / TIME_FALLOFF_MINUTES);
}

function scoreQuality(game, maxRank) {
  if (game.bgg_rank == null) return 0.5;
  if (!maxRank || maxRank <= 1) return 1;
  return Math.max(0, 1 - (game.bgg_rank - 1) / (maxRank - 1));
}

// games: 전체 게임 목록 (status 무관, 내부에서 approved만 후보로 씀)
// reviews: 이 유저의 리뷰 [{ game_id, total_score, games? }]
export function recommendGames({ games, reviews, count = DEFAULT_RESULT_COUNT } = {}) {
  const allGames = games || [];
  const myReviews = reviews || [];
  if (allGames.length === 0) return [];

  const gamesById = {};
  allGames.forEach((g) => { gamesById[g.id] = g; });

  const reviewedIds = new Set(myReviews.map((r) => r.game_id));
  const profile = buildTasteProfile(myReviews, gamesById);

  const candidates = allGames.filter((g) => g.status === "approved" && !reviewedIds.has(g.id));
  if (candidates.length === 0) return [];

  const maxRank = allGames.reduce((max, g) => (g.bgg_rank != null ? Math.max(max, g.bgg_rank) : max), 1);

  const scored = candidates.map((game) => {
    const genreScore = scoreGenre(game.genre, profile.genreWeights);
    const playerScore = scorePlayers(game, profile.preferredPlayers);
    const timeScore = scoreTime(game, profile.preferredMinutes);
    const qualityScore = scoreQuality(game, maxRank);
    const total =
      genreScore * GENRE_WEIGHT +
      playerScore * PLAYER_WEIGHT +
      timeScore * TIME_WEIGHT +
      qualityScore * QUALITY_WEIGHT;
    return { game, total };
  });

  scored.sort((a, b) => b.total - a.total);

  // 다양성 보정: 같은 장르가 MAX_PER_GENRE를 넘으면 건너뛰고 다음 순위로 대체
  const result = [];
  const genreCount = {};
  for (const { game } of scored) {
    if (result.length >= count) break;
    const genres = game.genre || [];
    const exceeds = genres.some((g) => (genreCount[g] || 0) >= MAX_PER_GENRE);
    if (exceeds) continue;
    result.push(game);
    genres.forEach((g) => { genreCount[g] = (genreCount[g] || 0) + 1; });
  }
  return result;
}

export function buildTasteSummary(profile, nickname) {
  if (!isEligibleForRecommendation(profile)) {
    return "기록이 더 쌓이면 취향을 분석해드릴게요";
  }

  const genreText = profile.topGenres.slice(0, 2).join("·") || null;
  const playerText = profile.preferredPlayers != null ? `${profile.preferredPlayers}인` : null;
  const minuteText = profile.preferredMinutes != null ? `${Math.round(profile.preferredMinutes / 10) * 10}분 내외` : null;
  const playTimeText = [playerText, minuteText].filter(Boolean).join(" ") || null;

  const parts = [];
  if (genreText) parts.push(`${genreText} 장르를 좋아하고`);
  if (playTimeText) parts.push(`${playTimeText} 게임을 자주 기록했어요`);

  if (parts.length === 0) return `${nickname}님의 취향을 분석하고 있어요`;
  return `${nickname}님은 ${parts.join(", ")}`;
}
