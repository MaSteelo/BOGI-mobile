// 사용법:
//   node upload_game_image.js <game-id> --bgg <bgg-game-id>
//   node upload_game_image.js <game-id> --url <image-url>
//   node upload_game_image.js <game-id> --file <파일경로>
//
// SUPABASE_SERVICE_KEY 환경변수 필요:
//   SUPABASE_SERVICE_KEY=eyJ... node upload_game_image.js ...

const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://nwvyezccwzkpyqiqaejk.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53dnllemNjd3prcHlxaXFhZWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNTA4MTUsImV4cCI6MjA5MzkyNjgxNX0.eHvEbiwJYdWADXeY30sMLcaXmoxO3CKTMsvmMoUh7bY';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
const BGG_AUTH = 'Bearer 002f773e-5bd8-43c1-8964-ed078f044681';
const STORAGE_BUCKET = 'game-images';
const STORAGE_PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/`;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

async function fromBgg(bggId) {
  const url = `https://boardgamegeek.com/xmlapi2/thing?id=${bggId}&type=boardgame`;
  for (let i = 0; i < 3; i++) {
    const res = await fetchUrl(url, { Authorization: BGG_AUTH });
    if (res.statusCode === 202) {
      console.log('BGG 처리 중... 3초 대기');
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }
    if (res.statusCode !== 200) throw new Error(`BGG API ${res.statusCode}`);
    const xml = res.body.toString('utf-8');
    const match = xml.match(/<image>\s*(.*?)\s*<\/image>/);
    if (!match) throw new Error('BGG XML에 <image> 태그 없음');
    let imageUrl = match[1].trim();
    if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
    return await fromUrl(imageUrl);
  }
  throw new Error('BGG API 응답 실패 (202 반복)');
}

async function fromUrl(imageUrl) {
  console.log('다운로드:', imageUrl);
  const res = await fetchUrl(imageUrl);
  if (res.statusCode !== 200) throw new Error(`이미지 다운로드 실패: ${res.statusCode}`);
  const contentType = res.headers['content-type'] || 'image/jpeg';
  const ext = contentType.includes('png') ? 'png' : contentType.includes('gif') ? 'gif' : 'jpg';
  return { buffer: res.body, contentType, ext };
}

async function fromFile(filePath) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) throw new Error(`파일 없음: ${absPath}`);
  const buffer = fs.readFileSync(absPath);
  const ext = path.extname(filePath).slice(1).toLowerCase() || 'jpg';
  const contentType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
  return { buffer, contentType, ext };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.log('사용법:');
    console.log('  node upload_game_image.js <game-id> --bgg <bgg-game-id>');
    console.log('  node upload_game_image.js <game-id> --url <image-url>');
    console.log('  node upload_game_image.js <game-id> --file <파일경로>');
    console.log('\n이미지 없는 게임 목록:');
    const { data, error } = await supabase.from('games').select('id, name_ko, name_en, image_url');
    if (!error) {
      data
        .filter((g) => !g.image_url || !g.image_url.startsWith(STORAGE_PUBLIC_PREFIX))
        .forEach((g) => console.log(`  ${g.id}  ${g.name_ko}  (${g.name_en || ''})`));
    }
    process.exit(0);
  }

  const gameId = args[0];
  const mode = args[1];
  const value = args[2];

  // 게임 존재 확인 (전체 UUID 또는 앞 8자 축약 ID 지원)
  const { data: allGames, error: gameError } = await supabase
    .from('games')
    .select('id, name_ko, name_en');
  const game = allGames?.find((g) => g.id === gameId || g.id.startsWith(gameId));

  if (gameError || !game) {
    console.error('게임을 찾을 수 없습니다:', gameId);
    process.exit(1);
  }

  const fullId = game.id;
  const name = game.name_ko || game.name_en;
  console.log(`대상 게임: ${name} (${fullId})`);

  let imageData;
  if (mode === '--bgg') {
    console.log(`BGG ID ${value}에서 이미지 가져오기...`);
    imageData = await fromBgg(value);
  } else if (mode === '--url') {
    imageData = await fromUrl(value);
  } else if (mode === '--file') {
    imageData = await fromFile(value);
  } else {
    console.error('알 수 없는 옵션:', mode);
    process.exit(1);
  }

  const { buffer, contentType, ext } = imageData;
  const filename = `${fullId}.${ext}`;

  console.log(`Supabase Storage 업로드: ${filename} (${buffer.length} bytes)`);
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filename, buffer, { contentType, upsert: true });

  if (uploadError) {
    console.error('업로드 실패:', uploadError.message);
    process.exit(1);
  }

  const publicUrl = `${STORAGE_PUBLIC_PREFIX}${filename}`;

  const { error: updateError } = await supabase
    .from('games')
    .update({ image_url: publicUrl })
    .eq('id', fullId);

  if (updateError) {
    console.error('DB 업데이트 실패:', updateError.message);
    process.exit(1);
  }

  console.log(`완료: ${name} → ${publicUrl}`);
}

main().catch((err) => {
  console.error('오류:', err.message);
  process.exit(1);
});
