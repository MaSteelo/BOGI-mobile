const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const http = require('http');

const SUPABASE_URL = 'https://nwvyezccwzkpyqiqaejk.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53dnllemNjd3prcHlxaXFhZWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNTA4MTUsImV4cCI6MjA5MzkyNjgxNX0.eHvEbiwJYdWADXeY30sMLcaXmoxO3CKTMsvmMoUh7bY';
// service role key는 RLS를 우회 — 환경변수로 주입: SUPABASE_SERVICE_KEY=xxx node fetch_bgg_images.js
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
const BGG_AUTH = 'Bearer 002f773e-5bd8-43c1-8964-ed078f044681';
const STORAGE_BUCKET = 'game-images';
const STORAGE_PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/`;

if (process.env.SUPABASE_SERVICE_KEY) {
  console.log('service role key 사용 (RLS 우회)\n');
} else {
  console.log('anon key 사용 (Storage RLS 정책 필요)\n');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchUrl(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers: { 'User-Agent': 'BGGImageFetcher/1.0', ...headers },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchUrl(res.headers.location, headers).then(resolve).catch(reject);
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () =>
          resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks), headers: res.headers })
        );
      }
    );
    req.on('error', reject);
  });
}

// name_en으로 BGG 게임 ID 검색
async function searchBggId(name) {
  const query = encodeURIComponent(name);
  const url = `https://boardgamegeek.com/xmlapi2/search?query=${query}&type=boardgame&exact=1`;
  const res = await fetchUrl(url, { Authorization: BGG_AUTH });
  if (res.statusCode !== 200) return null;
  const xml = res.body.toString('utf-8');
  const match = xml.match(/<item[^>]*type="boardgame"[^>]*id="(\d+)"/);
  return match ? match[1] : null;
}

// BGG game ID로 <image> URL 가져오기
async function fetchBggImageUrl(bggId) {
  const url = `https://boardgamegeek.com/xmlapi2/thing?id=${bggId}&type=boardgame,boardgameexpansion`;

  // BGG API는 처음 요청 시 202를 반환할 수 있음 — 최대 3회 재시도
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetchUrl(url, { Authorization: BGG_AUTH });
    if (res.statusCode === 202) {
      await sleep(3000);
      continue;
    }
    if (res.statusCode !== 200) throw new Error(`BGG API ${res.statusCode}`);
    const xml = res.body.toString('utf-8');
    const match = xml.match(/<image>\s*(.*?)\s*<\/image>/);
    if (!match) return null;
    let imageUrl = match[1].trim();
    if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
    return imageUrl;
  }
  return null;
}

async function downloadImage(url) {
  const res = await fetchUrl(url);
  if (res.statusCode !== 200) throw new Error(`이미지 다운로드 실패: ${res.statusCode}`);
  const contentType = res.headers['content-type'] || 'image/jpeg';
  const ext = contentType.includes('png') ? 'png' : contentType.includes('gif') ? 'gif' : 'jpg';
  return { buffer: res.body, contentType, ext };
}

async function main() {
  const { data: games, error } = await supabase
    .from('games')
    .select('id, name_ko, name_en, image_url');

  if (error) {
    console.error('DB 조회 실패:', error.message);
    process.exit(1);
  }

  const total = games.length;
  console.log(`총 ${total}개 게임 처리 시작\n`);

  let count = 0;
  for (const game of games) {
    count++;
    const name = game.name_ko || game.name_en || `id:${game.id}`;

    if (game.image_url && game.image_url.startsWith(STORAGE_PUBLIC_PREFIX)) {
      console.log(`${count}/${total} ${name} → 건너뜀 (이미 Storage URL)`);
      continue;
    }

    try {
      // name_en이 없으면 건너뜀
      if (!game.name_en) {
        console.log(`${count}/${total} ${name} → name_en 없음, 건너뜀`);
        continue;
      }

      // BGG에서 게임 ID 검색
      const bggId = await searchBggId(game.name_en);
      if (!bggId) {
        console.log(`${count}/${total} ${name} → BGG에서 찾지 못함`);
        await sleep(2000);
        continue;
      }

      await sleep(2000);

      // BGG에서 이미지 URL 가져오기
      const bggImageUrl = await fetchBggImageUrl(bggId);
      if (!bggImageUrl) {
        console.log(`${count}/${total} ${name} → BGG 이미지 없음`);
        await sleep(2000);
        continue;
      }

      // 이미지 다운로드
      const { buffer, contentType, ext } = await downloadImage(bggImageUrl);

      // Supabase Storage 업로드
      const filename = `${game.id}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filename, buffer, { contentType, upsert: true });

      if (uploadError) {
        console.error(`${count}/${total} ${name} → 업로드 실패: ${uploadError.message}`);
        await sleep(2000);
        continue;
      }

      const publicUrl = `${STORAGE_PUBLIC_PREFIX}${filename}`;

      // DB 업데이트
      const { error: updateError } = await supabase
        .from('games')
        .update({ image_url: publicUrl })
        .eq('id', game.id);

      if (updateError) {
        console.error(`${count}/${total} ${name} → DB 업데이트 실패: ${updateError.message}`);
      } else {
        console.log(`${count}/${total} ${name} → ${publicUrl}`);
      }
    } catch (err) {
      console.error(`${count}/${total} ${name} → 오류: ${err.message}`);
    }

    await sleep(2000);
  }

  console.log('\n완료!');
}

main();
