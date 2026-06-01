/**
 * BGG Top 1000 → BOGI DB import script
 *
 * 추가 설치 불필요 (이미 설치됨: @supabase/supabase-js, xml2js)
 *
 * 실행:
 *   SUPABASE_SERVICE_KEY=eyJ... node import_bgg_top_games.js
 *
 * 중간에 끊겨도 재실행 시 이미 추가된 게임은 건너뜀 (name_en / bgg_rank 중복 체크)
 */

'use strict';

const https = require('https');
const http = require('http');
const xml2js = require('xml2js');
const { createClient } = require('@supabase/supabase-js');

// ── Config ────────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://nwvyezccwzkpyqiqaejk.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const STORAGE_BUCKET = 'game-images';
const BGG_AUTH = 'Bearer 002f773e-5bd8-43c1-8964-ed078f044681';
const BGG_BATCH_SIZE = 20;   // 한 번에 조회할 BGG ID 수
const DELAY_BGG = 3000;      // BGG API 요청 간 딜레이 (ms)
const DELAY_IMG = 1000;      // Storage 업로드 간 딜레이 (ms)
const DELAY_ERR = 5000;      // 에러 후 대기 (ms)
const MAX_RETRY = 3;

if (!SUPABASE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY 환경변수를 설정해주세요.');
  console.error('   SUPABASE_SERVICE_KEY=eyJ... node import_bgg_top_games.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const STORAGE_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/`;

// ── 장르 매핑 (BGG 영문 카테고리 → 한국어) ────────────────────────────────────
const GENRE_MAP = {
  'Strategy':              '전략',
  'Strategy Games':        '전략',
  'Family':                '가족',
  'Family Games':          '가족',
  'Party':                 '파티',
  'Party Games':           '파티',
  'Abstract':              '추상',
  'Abstract Games':        '추상',
  'Thematic':              '테마',
  'War':                   '워게임',
  'Wargame':               '워게임',
  'Wargames':              '워게임',
  'Card Game':             '카드',
  'Dice':                  '다이스',
  'Cooperative':           '협력',
  'Cooperative Games':     '협력',
  'Economic':              '경제',
  'Deduction':             '추리',
  'Adventure':             '어드벤처',
  'Puzzle':                '퍼즐',
  'Negotiation':           '협상',
  'Racing':                '레이싱',
  'Bluffing':              '정체은닉',
  'Fighting':              '격투',
  'Fantasy':               '판타지',
  'Science Fiction':       'SF',
  'Exploration':           '탐험',
  'Trivia':                '퀴즈',
  'Word':                  '단어',
  'Action / Dexterity':    '액션',
  'Children\'s Games':     '어린이',
  'City Building':         '도시건설',
  'Medieval':              '중세',
  'Industry / Manufacturing': '산업',
  'Farming':               '농업',
  'Horror':                '공포',
  'Nautical':              '해양',
  'Space Exploration':     '우주',
  'Political':             '정치',
  'Ancient':               '고대',
  'Animals':               '동물',
  'Memory':                '기억력',
  'Renaissance':           '르네상스',
  'Number':                '숫자',
  'Medical':               '의료',
  'Miniatures':            '미니어처',
};

function mapGenres(categories) {
  const seen = new Set();
  const result = [];
  for (const c of categories) {
    const mapped = GENRE_MAP[c] || c;
    if (!seen.has(mapped)) {
      seen.add(mapped);
      result.push(mapped);
    }
  }
  return result.slice(0, 6);
}

// ── 유틸 ─────────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function asArray(val) {
  if (val == null) return [];
  return Array.isArray(val) ? val : [val];
}

function normalizeUrl(url) {
  if (!url) return null;
  let u = String(url).trim();
  if (u.startsWith('//')) u = 'https:' + u;
  if (u.startsWith('http://')) u = 'https://' + u.slice(7);
  return u.startsWith('https://') ? u : null;
}

function stripHtml(str) {
  if (!str) return null;
  return str
    .replace(/&#10;/g, '\n')
    .replace(/&#9;/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim() || null;
}

function parseXml(str) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(str, { explicitArray: false, trim: true }, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// ── HTTP 요청 (내장 모듈, 리다이렉트 처리) ────────────────────────────────────
function fetchUrl(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: {
        'User-Agent': 'BOGI-Import/1.0 (contact: talljoongi@gmail.com)',
        ...opts.headers,
      },
    };
    lib.get(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location.startsWith('http')
          ? res.headers.location
          : `${parsed.protocol}//${parsed.host}${res.headers.location}`;
        fetchUrl(loc, opts).then(resolve).catch(reject);
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () =>
        resolve({ status: res.statusCode, body: Buffer.concat(chunks), headers: res.headers })
      );
    }).on('error', reject);
  });
}

async function fetchWithRetry(url, opts = {}, retries = MAX_RETRY) {
  for (let i = 1; i <= retries; i++) {
    try {
      const res = await fetchUrl(url, opts);
      if (res.status === 429 || res.status === 503) {
        const wait = DELAY_ERR * i;
        process.stdout.write(`  ⏳ Rate limited (${res.status}), ${wait / 1000}s 대기...\n`);
        await sleep(wait);
        continue;
      }
      return res;
    } catch (err) {
      if (i === retries) throw err;
      process.stdout.write(`  ⚠️  요청 실패 (${i}/${retries}): ${err.message}\n`);
      await sleep(DELAY_ERR);
    }
  }
}

// ── 하드코딩된 BGG TOP 게임 IDs ───────────────────────────────────────────────
const BGG_TOP_IDS = [
  11, 13, 42, 93, 171, 188, 521, 822, 2223, 2453,
  2511, 2651, 2655, 3076, 3955, 4098, 5404, 6472, 7865, 9209,
  9220, 9674, 10547, 11481, 12002, 12333, 14996, 15045, 17329, 18837,
  21882, 24068, 25554, 25613, 25669, 27225, 28023, 28143, 28720, 30549,
  30869, 31260, 32016, 34219, 34585, 35497, 35677, 36218, 36553, 37111,
  37242, 37380, 38453, 39463, 39856, 40398, 40692, 40834, 41114, 42215,
  43015, 43443, 44267, 46213, 47949, 50750, 52225, 53953, 54408, 54998,
  55514, 57275, 59959, 62219, 63888, 66188, 68425, 68448, 70149, 70323,
  71721, 72991, 73439, 75166, 77423, 80006, 82222, 84876, 85716, 87507,
  90137, 92828, 95106, 96848, 97207, 98229, 98778, 100901, 102680, 102794,
  104006, 104162, 105551, 106774, 107529, 109276, 110308, 110327, 112686, 113924,
  114431, 115746, 116954, 118516, 119890, 120677, 121408, 121921, 121931, 123260,
  124361, 124742, 126163, 127023, 128271, 128621, 128882, 129622, 130799, 131357,
  131835, 132018, 133038, 134352, 135219, 136063, 136888, 137408, 138161, 139407,
  140620, 141987, 143516, 144592, 145654, 146021, 146508, 146652, 147151, 147949,
  148228, 148949, 150145, 150376, 151347, 152581, 153999, 154737, 155426, 155821,
  156129, 156497, 157809, 157969, 158899, 159675, 160477, 161533, 161936, 162082,
  162886, 163166, 163412, 164153, 164928, 165722, 166960, 167355, 167791, 167901,
  168817, 169654, 169786, 170042, 170216, 170561, 171131, 172081, 172287, 172801,
  172818, 173346, 173514, 173667, 174430, 174614, 175640, 175914, 176494, 177239,
  177736, 178870, 178900, 178996, 179172, 180040, 180263, 180543, 181279, 181304,
  182028, 182874, 183394, 183840, 184267, 184522, 185343, 185680, 186749, 187113,
  187645, 188174, 189063, 190225, 191004, 191055, 191771, 191862, 192135, 192291,
  192457, 193039, 193738, 194594, 195137, 196062, 196340, 196967, 197467, 198158,
  198773, 198994, 199042, 199316, 199561, 199792, 200044, 200680, 200883, 201472,
  201808, 201921, 202178, 203417, 203780, 203993, 204583, 205059, 205637, 205896,
  206718, 207830, 208478, 209010, 209418, 210677, 211044, 212269, 213061, 214032,
  214830, 215312, 215394, 216132, 217372, 218603, 219513, 220308, 220877, 221107,
  221194, 222514, 222597, 223321, 224037, 224517, 225694, 226320, 226677, 227789,
  228341, 229220, 230085, 230802, 231398, 231733, 232405, 233078, 233867, 234487,
  235457, 235528, 236457, 237182, 237454, 238582, 239188, 239472, 239571, 240225,
  241451, 242302, 243693, 244521, 244711, 244714, 244992, 245655, 246900, 247694,
  247763, 248435, 249397, 250263, 251247, 251489, 252283, 253344, 254640, 255681,
  255984, 256226, 256382, 256916, 256960, 257668, 258036, 259354, 260302, 261196,
  262573, 263234, 263918, 264220, 264647, 265188, 266192, 266277, 266507, 266810,
  267378, 268420, 269210, 269385, 270239, 270673, 271324, 272483, 272833, 273477,
  274093, 275467, 276025, 276498, 277293, 278054, 279184, 280212, 281259, 282187,
  283227, 284083, 284378, 284435, 285192, 286063, 286096, 287230, 288195, 289279,
  290448, 291453, 291457, 292539, 293014, 293434, 294196, 295367, 295947, 296476,
  297556, 298258, 299449, 299649, 300531, 301427, 302260, 303164, 304006, 305088,
  306735, 307529, 308765, 309260, 310685, 310873, 311193, 312009, 312484, 313142,
  316554, 317985, 323612, 324856, 328871, 329592, 329629, 329778, 334986, 336986,
  337627, 340790, 342942, 347516, 353545, 354193, 355483, 356305, 359438, 359871,
  361545, 362452, 365717, 366013, 368017, 369478, 370591, 373106, 374173, 379313,
  381094, 384223, 385610,
];

// ── Step 1: BGG Hot API + 하드코딩 리스트로 ID 수집 ──────────────────────────
async function fetchBggTopIds() {
  console.log('\n📋 BGG Hot API + 하드코딩 리스트로 ID 수집 중...');
  const seen = new Set();
  const ids = [];

  // 1. BGG Hot API (현재 인기 게임 ~50개)
  try {
    const res = await fetchWithRetry(
      'https://boardgamegeek.com/xmlapi2/hot?type=boardgame',
      { headers: { Authorization: BGG_AUTH } }
    );
    if (res && res.status === 200) {
      const xml = res.body.toString('utf-8');
      const matches = [...xml.matchAll(/\sid="(\d+)"/g)];
      for (const m of matches) {
        const id = m[1];
        if (!seen.has(id)) { seen.add(id); ids.push(id); }
      }
      console.log(`  BGG Hot API: ${ids.length}개 수집`);
    } else {
      console.log(`  ⚠️ Hot API 응답 ${res?.status}`);
    }
  } catch (err) {
    console.log(`  ⚠️ Hot API 실패: ${err.message}`);
  }

  // 2. 하드코딩 TOP IDs
  const beforeHard = ids.length;
  for (const id of BGG_TOP_IDS) {
    const s = String(id);
    if (!seen.has(s)) { seen.add(s); ids.push(s); }
  }
  console.log(`  하드코딩 리스트: ${ids.length - beforeHard}개 추가`);

  const unique = [...new Set(ids)];
  console.log(`✅ 총 ${unique.length}개 ID 준비\n`);
  return unique;
}

// ── Step 2: BGG XMLAPI2로 게임 상세 정보 일괄 조회 ───────────────────────────
async function fetchBggBatch(ids) {
  const url = `https://boardgamegeek.com/xmlapi2/thing?id=${ids.join(',')}&stats=1`;

  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    const res = await fetchWithRetry(url, { headers: { Authorization: BGG_AUTH } });
    if (!res) throw new Error('응답 없음');

    // BGG가 202를 반환하면 아직 처리 중 → 재시도
    if (res.status === 202) {
      process.stdout.write(`  ⏳ BGG 응답 대기 중 (${attempt}/${MAX_RETRY})...\n`);
      await sleep(DELAY_ERR);
      continue;
    }
    if (res.status !== 200) throw new Error(`BGG API HTTP ${res.status}`);

    const xml = res.body.toString('utf-8');
    const parsed = await parseXml(xml);
    const raw = parsed?.items?.item;
    if (!raw) return [];
    return asArray(raw);
  }
  throw new Error('BGG API 최대 재시도 초과');
}

// ── Step 3: XML 아이템 → 게임 데이터 추출 ────────────────────────────────────
function extractGameData(item) {
  const bggId = item?.$?.id;

  // 이름
  const names = asArray(item.name);
  const primaryName = names.find((n) => n?.$?.type === 'primary')?.$?.value ?? '';
  // 한국어 대체명 (유니코드 가나다 범위)
  const koName =
    names.find((n) => n?.$?.value && /[가-힣]/.test(n?.$?.value))?.$?.value ?? null;

  // 카테고리 → 장르
  const links = asArray(item.link);
  const categories = links
    .filter((l) => l?.$?.type === 'boardgamecategory')
    .map((l) => l?.$?.value)
    .filter(Boolean);
  const genre = mapGenres(categories);

  // 출판사 (첫 번째)
  const publisher =
    links.find((l) => l?.$?.type === 'boardgamepublisher')?.$?.value ?? null;

  // BGG 통계
  const ratings = item.statistics?.ratings;
  const ranks = asArray(ratings?.ranks?.rank);
  const bggRankRaw = ranks.find((r) => r?.$?.name === 'boardgame')?.$?.value;
  const bggRank =
    bggRankRaw && bggRankRaw !== 'Not Ranked' ? parseInt(bggRankRaw) : null;
  const bggRating = parseFloat(ratings?.average?.$?.value) || null;

  // 기본 정보
  const minPlayers = parseInt(item.minplayers?.$?.value) || null;
  const maxPlayers = parseInt(item.maxplayers?.$?.value) || null;
  const playTime = parseInt(item.playingtime?.$?.value) || null;
  const minAge = parseInt(item.minage?.$?.value) || null;
  const yearPublished = parseInt(item.yearpublished?.$?.value) || null;

  // 설명 (HTML 제거)
  const description = stripHtml(
    Array.isArray(item.description) ? item.description[0] : item.description
  );

  // 이미지 URL 정규화
  const rawImage = Array.isArray(item.image) ? item.image[0] : item.image;
  const bggImageUrl = normalizeUrl(rawImage);

  return {
    bggId,
    name_en: primaryName,
    name_ko: koName,
    genre,
    min_players: minPlayers,
    max_players: maxPlayers,
    play_minutes: playTime,
    min_age: minAge,
    bgg_rank: bggRank,
    bgg_rating: bggRating,
    year_published: yearPublished,
    publisher,
    description,
    bggImageUrl,
  };
}

// ── Step 4: 이미지 다운로드 → Supabase Storage 업로드 ─────────────────────────
async function uploadImage(bggId, bggImageUrl) {
  if (!bggImageUrl) return null;

  try {
    const res = await fetchWithRetry(bggImageUrl);
    if (!res || res.status !== 200) return bggImageUrl; // fallback: BGG URL 그대로 사용

    const contentType = res.headers['content-type']?.split(';')[0] || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png'
      : contentType.includes('webp') ? 'webp'
      : contentType.includes('gif') ? 'gif'
      : 'jpg';
    const filename = `bgg_${bggId}.${ext}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filename, res.body, { contentType, upsert: true });

    if (error) {
      process.stdout.write(`  ⚠️  Storage 업로드 실패: ${error.message} → BGG URL 사용\n`);
      return bggImageUrl;
    }

    return `${STORAGE_PREFIX}${filename}`;
  } catch (err) {
    process.stdout.write(`  ⚠️  이미지 처리 실패: ${err.message} → BGG URL 사용\n`);
    return bggImageUrl;
  }
}

// ── Step 5: 기존 게임 조회 (중복 체크용) ──────────────────────────────────────
async function getExistingGames() {
  const { data, error } = await supabase
    .from('games')
    .select('name_en, bgg_rank');

  if (error) throw new Error(`기존 게임 조회 실패: ${error.message}`);

  const byName = new Set((data || []).map((g) => g.name_en?.toLowerCase().trim()).filter(Boolean));
  const byRank = new Set((data || []).map((g) => g.bgg_rank).filter(Boolean));
  return { byName, byRank };
}

// ── Step 6: DB INSERT ─────────────────────────────────────────────────────────
async function insertGame(g) {
  const row = {
    name_en: g.name_en || null,
    name_ko: g.name_ko || g.name_en || null,
    genre: g.genre?.length ? g.genre : null,
    min_players: g.min_players,
    max_players: g.max_players,
    play_minutes: g.play_minutes,
    min_age: g.min_age,
    bgg_rank: g.bgg_rank,
    image_url: g.image_url || null,
    publisher: g.publisher || null,
    description: g.description || null,
    status: 'approved',
    // 아래 두 컬럼은 DB 스키마에 없으면 주석 처리:
    // bgg_rating: g.bgg_rating,
    // year_published: g.year_published,
  };

  const { error } = await supabase.from('games').insert(row);
  if (error) throw new Error(error.message);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🎲 BGG Top 보드게임 → BOGI DB import 시작\n');
  console.log(`  BGG 배치 크기: ${BGG_BATCH_SIZE}개`);
  console.log(`  BGG 딜레이: ${DELAY_BGG / 1000}s | 이미지 딜레이: ${DELAY_IMG / 1000}s\n`);

  // 기존 게임 로드
  process.stdout.write('📦 기존 게임 목록 조회 중...');
  const { byName, byRank } = await getExistingGames();
  process.stdout.write(` ${byName.size}개 확인\n\n`);

  // BGG TOP ID 수집
  const bggIds = await fetchBggTopIds();
  if (bggIds.length === 0) {
    console.error('❌ BGG ID를 수집하지 못했습니다.');
    process.exit(1);
  }

  let added = 0;
  let skipped = 0;
  let failed = 0;
  let counter = 0;

  for (let i = 0; i < bggIds.length; i += BGG_BATCH_SIZE) {
    const batch = bggIds.slice(i, i + BGG_BATCH_SIZE);
    let items;

    try {
      items = await fetchBggBatch(batch);
    } catch (err) {
      console.log(`❌ 배치[${i}~${i + batch.length}] API 오류: ${err.message}`);
      failed += batch.length;
      await sleep(DELAY_ERR);
      continue;
    }

    for (const item of items) {
      counter++;
      const g = extractGameData(item);
      const label = `[${String(counter).padStart(3)}/${bggIds.length}] ${g.name_en || '?'} (BGG #${g.bgg_rank ?? '?'})`;

      // 중복 체크
      const nameKey = g.name_en?.toLowerCase().trim();
      if (
        (nameKey && byName.has(nameKey)) ||
        (g.bgg_rank && byRank.has(g.bgg_rank))
      ) {
        console.log(`${label} → ⏭  이미 존재`);
        skipped++;
        continue;
      }

      // 이미지 업로드
      let imageUrl = g.bggImageUrl;
      if (imageUrl) {
        try {
          imageUrl = await uploadImage(g.bggId, imageUrl);
          await sleep(DELAY_IMG);
        } catch (err) {
          process.stdout.write(`  ⚠️  이미지 오류: ${err.message}\n`);
        }
      }

      // DB INSERT
      try {
        await insertGame({ ...g, image_url: imageUrl });
        if (nameKey) byName.add(nameKey);
        if (g.bgg_rank) byRank.add(g.bgg_rank);
        console.log(`${label} → ✅ 추가 완료`);
        added++;
      } catch (err) {
        console.log(`${label} → ❌ 에러: ${err.message}`);
        failed++;
      }
    }

    // 배치 간 딜레이
    if (i + BGG_BATCH_SIZE < bggIds.length) {
      await sleep(DELAY_BGG);
    }
  }

  console.log('\n' + '─'.repeat(50));
  console.log('🎉 완료!');
  console.log(`  ✅ 추가됨:  ${added}개`);
  console.log(`  ⏭  건너뜀: ${skipped}개`);
  console.log(`  ❌ 실패:   ${failed}개`);
  console.log('─'.repeat(50) + '\n');
}

main().catch((err) => {
  console.error('\n❌ 치명적 오류:', err.message);
  process.exit(1);
});
