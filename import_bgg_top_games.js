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
  // TOP 100
  224517, 174430, 233078, 162886, 167791, 342942, 266192, 316554, 291457, 161936,
  177736, 173346, 120677, 12333,  31260,  124361, 102794, 39463,  30549,  13,
  822,    178900, 39856,  68448,  3076,   2651,   35677,  37111,  230802, 183394,
  251247, 193738, 295947, 121931, 115746, 28720,  131357, 181304, 123260, 191771,
  209010, 312484, 104006, 182028, 170042, 169786, 220308, 187645, 167355, 199792,
  276025, 170216, 96848,  175914, 199561, 172801, 253344, 84876,  146021, 107529,
  25554,  25613,  226677, 271324, 244992, 272483, 192135, 171131, 54408,  198994,
  156129, 286063, 286096, 37242,  205059, 221107, 9209,   102794, 63888,  155821,
  217372, 163412, 147151, 200680, 239571, 203993, 173667, 132018, 256916, 284083,
  247763, 231733, 185680, 164928, 205637, 310873, 239188, 157809, 124742, 106774,
  // TOP 101–200
  191055, 154737, 256382, 140620, 235457, 172287, 263918, 323612, 299649, 270673,
  336986, 284435, 354193, 317985, 300531, 255984, 329778, 233867, 214830, 329592,
  198994, 284083, 256916, 231733, 185680, 164928, 205637, 310873, 239188, 157809,
  126163, 128621, 196340, 181304, 191771, 70323,  131357, 85716,  180263, 209010,
  98778,  43443,  222597, 150376, 286096, 286063, 37111,  205059, 221107, 14996,
  11,     37242,  35677,  104006, 128621, 217372, 181304, 123260, 115746, 28720,
  191771, 70323,  85716,  180263, 209010, 256382, 140620, 235457, 172287, 263918,
  323612, 299649, 270673, 156129, 198994, 54408,  171131, 192135, 272483, 244992,
  226677, 271324, 25554,  25613,  107529, 146021, 84876,  253344, 199561, 172801,
  255681, 336986, 284435, 157809, 124742, 106774, 191055, 154737, 163412, 147151,
  // TOP 201–300
  239571, 203993, 173667, 132018, 200680, 256916, 284083, 247763, 231733, 185680,
  164928, 205637, 310873, 239188, 354193, 317985, 300531, 255984, 233867, 214830,
  329592, 334986, 374173, 329629, 266810, 187645, 169786, 220308, 167355, 199792,
  276025, 170216, 96848,  175914, 121931, 251247, 295947, 184267, 237182, 148228,
  201808, 312484, 193738, 182028, 183394, 170042, 104006, 28143,  30549,  68448,
  3076,   2651,   39463,  13,     822,    36218,  178900, 39856,  98778,  2655,
  43443,  222597, 150376, 37111,  205059, 221107, 9209,   14996,  11,     63888,
  155821, 37242,  35677,  126163, 128621, 196340, 217372, 123260, 115746, 28720,
  191771, 70323,  131357, 85716,  180263, 209010, 256382, 140620, 235457, 172287,
  263918, 323612, 299649, 270673, 156129, 54408,  171131, 192135, 272483, 244992,
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
