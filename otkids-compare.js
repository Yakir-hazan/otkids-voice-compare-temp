
// otkids-compare.js: the same feedback sentences (positive and gentle) from the games in several Gemini voices, to compare them.
// Node 16+, no dependencies. Existing files are skipped, so it is safe to run again after a failure.
'use strict';
const https = require('https');
const fs = require('fs');
const path = require('path');

// Usage (key comes from the environment, never from the file):
//   export GEMINI_API_KEY='...'            (several keys: separate with commas)
//   node otkids-compare.js --test          (2 clips x all voices, quick check)
//   node otkids-compare.js                 (all clips x all voices)
// Options: --out <folder> (default audio-compare)  --delay <seconds> (default 10)
//          --only num,day (groups: p n; with --app also num day abc shp rhy wrl)  --app (also load the 1,109 game sentences; default: feedback clips only)
//          --voices Kore (default; add more only to compare)  --style "text" (default: no tone instruction)  --model <name>
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const KEYS = (process.env.GEMINI_API_KEY || '').split(/[\s,]+/).filter(Boolean);
const MODEL = arg('model', 'gemini-3.1-flash-tts-preview');
const DELAY_MS = Math.max(0, Math.round(Number(arg('delay', '10')) * 1000));
const OUT_DIR = arg('out', 'audio-compare');
if (!/^[A-Za-z0-9_.\/-]+$/.test(OUT_DIR) || OUT_DIR.includes('..')) { console.error('Bad --out folder name'); process.exit(2); }
const STYLE = arg('style', '');
const VOICES = arg('voices', 'Kore').split(',').map((s) => s.trim()).filter((s) => /^[A-Za-z]+$/.test(s));
const VARIANTS = [];
VOICES.forEach((v) => { const id = v.toLowerCase() + (STYLE ? '-calm' : ''); if (!VARIANTS.some((x) => x.id === id)) VARIANTS.push({ id, voice: v, style: STYLE }); });
const BASE_CLIPS = [{"name": "p-navon-meod", "text": "נכון מאוד!", "send": "נָכוֹן מְאוֹד!", "note": "positive: letter/picture games, after a correct answer"}, {"name": "p-yofi", "text": "יופי של דבר!", "send": "יוֹפִי שֶׁל דָּבָר!", "note": "positive: letter/picture games"}, {"name": "p-nehedar-memshichim", "text": "נהדר! ממשיכים ללמוד!", "send": "נֶהְדָּר! מַמְשִׁיכִים לִלְמוֹד!", "note": "positive: letter/picture games, encouragement to keep learning"}, {"name": "p-mamshichim", "text": "כל הכבוד! ממשיכים!", "send": "כָּל הַכָּבוֹד! מַמְשִׁיכִים!", "note": "positive: letter/picture games, moving on"}, {"name": "p-meule", "text": "מעולה!", "send": "מְעוּלֶּה!", "note": "positive: alphabet game"}, {"name": "p-yofi-tshuva", "text": "יופי של תשובה!", "send": "יֹפִי שֶׁל תְּשׁוּבָה!", "note": "positive: alphabet game"}, {"name": "p-wow-3-kochavim", "text": "וואו! שלושה כוכבים! כל הכבוד!", "send": "וואו! שלושה כוכבים! כל הכבוד!", "note": "positive: end screen, 3 stars (no nikud)"}, {"name": "n-karov", "text": "נסו שוב, אתם קרובים מאוד!", "send": "נַסּוּ שׁוּב, אַתֶּם קְרוֹבִים מְאוֹד!", "note": "gentle: listen-to-animal game, wrong answer"}, {"name": "n-kimat", "text": "כמעט! נסו שוב!", "send": "כִּמְעַט! נַסּוּ שׁוּב!", "note": "gentle: alphabet game, wrong answer"}, {"name": "n-kimat-count", "text": "כמעט! סופרים לאט, פריט אחר פריט, ולא שוכחים אף אחד.", "send": "כמעט! סוֹפְרִים לְאַט, פְּרִיט אַחַר פְּרִיט, וְלֹא שׁוֹכְחִים אַף אֶחָד.", "note": "gentle: numbers game, wrong answer + hint"}, {"name": "n-od-paam", "text": "עוד פעם! מסתכלים בקווים ובפינות, ונזכרים בשם שלה.", "send": "עוֹד פַּעַם! מִסְתַּכְּלִים בַּקַּוִּים וּבַפִּנּוֹת, וְנִזְכָּרִים בְּשֵׁם שֶׁלָּהּ.", "note": "gentle: shapes game, second wrong answer + hint"}, {"name": "n-waiting", "text": "אני מחכה לתשובה! כמה יש כאן?", "send": "אני מחכה לתשובה! כַּמָּה יֵשׁ כָּאן?", "note": "gentle nudge: numbers game, when the child is idle"}, {"name": "p-nehedar", "text": "נהדר!", "send": "נֶהְדָּר!", "note": "positive: general, after a correct answer (new)"}, {"name": "p-kol-hakavod", "text": "כל הכבוד!", "send": "כָּל הַכָּבוֹד!", "note": "positive: general, most common phrase in the games (new)"}, {"name": "p-nachon", "text": "נכון!", "send": "נָכוֹן!", "note": "positive: short, after a correct answer (new)"}, {"name": "p-metzuyan", "text": "מצוין!", "send": "מְצֻיָּן!", "note": "positive: short (new)"}, {"name": "p-teshuva-nechona", "text": "איזו תשובה נכונה!", "send": "אֵיזוֹ תְּשׁוּבָה נְכוֹנָה!", "note": "positive: after a correct answer (new)"}, {"name": "p-hitzlachtem", "text": "הצלחתם! כל הכבוד!", "send": "הִצְלַחְתֶּם! כָּל הַכָּבוֹד!", "note": "positive: end of a round (new)"}, {"name": "p-metzuyanim", "text": "אתם ממש מצוינים!", "send": "אַתֶּם מַמָּשׁ מְצֻיָּנִים!", "note": "positive: encouragement mid-game (new)"}, {"name": "p-lomdim-yafe", "text": "אתם לומדים כל כך יפה!", "send": "אַתֶּם לוֹמְדִים כָּל כָּךְ יָפֶה!", "note": "positive: encouragement mid-game (new)"}, {"name": "n-od-paam-2", "text": "עוד פעם!", "send": "עוֹד פַּעַם!", "note": "gentle: short, after a wrong answer (new)"}, {"name": "n-beseder", "text": "זה בסדר, נסו שוב!", "send": "זֶה בְּסֵדֶר, נַסּוּ שׁוּב!", "note": "gentle: after a wrong answer (new)"}, {"name": "n-lo-nora", "text": "לא נורא, כולם לומדים! נסו שוב!", "send": "לֹא נוֹרָא, כֻּלָּם לוֹמְדִים! נַסּוּ שׁוּב!", "note": "gentle: after a wrong answer (new)"}, {"name": "n-beyachad", "text": "בואו ננסה עוד פעם ביחד!", "send": "בּוֹאוּ נְנַסֶּה עוֹד פַּעַם בְּיַחַד!", "note": "gentle: second wrong answer (new)"}, {"name": "n-hakshivu", "text": "הקשיבו שוב, ובחרו לאט.", "send": "הַקְשִׁיבוּ שׁוּב, וּבִחֲרוּ לְאַט.", "note": "gentle: listening games, after a wrong answer (new)"}, {"name": "n-ani-kan", "text": "אני כאן איתכם, נסו עוד פעם!", "send": "אֲנִי כָּאן אִתְּכֶם, נַסּוּ עוֹד פַּעַם!", "note": "gentle: second wrong answer (new)"}, {"name": "n-kimat-sham", "text": "כמעט שם! עוד ניסיון אחד!", "send": "כִּמְעַט שָׁם! עוֹד נִסָּיוֹן אֶחָד!", "note": "gentle: close answer (new)"}];
const TEST = argv.includes('--test');
const ONLY = arg('only', '').split(',').map((s) => s.trim()).filter(Boolean);   // groups: p n (core) num day abc shp rhy wrl (app)
const USE_APP = !TEST && argv.includes('--app');
const APP_CLIPS_URL = 'https://raw.githubusercontent.com/Yakir-hazan/otkids-voice-compare-temp/main/clips.json';
let ALL_CLIPS = BASE_CLIPS;
let CLIPS = [];
function getJson(url, hops) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'otkids-compare' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && (hops || 0) < 3) { res.resume(); resolve(getJson(res.headers.location, (hops || 0) + 1)); return; }
      if (res.statusCode !== 200) { res.resume(); reject(new Error('HTTP ' + res.statusCode)); return; }
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
  });
}
async function loadClips() {
  if (USE_APP) {
    let app;
    try { app = await getJson(APP_CLIPS_URL); } catch (e) { throw new Error('Could not load the app sentences from GitHub (' + e.message + '). Check the connection and run again.'); }
    ALL_CLIPS = BASE_CLIPS.concat(app);
    console.log('app sentences loaded: ' + app.length);
  }
  if (TEST) ALL_CLIPS = BASE_CLIPS.filter((c) => ['p-navon-meod', 'n-karov'].includes(c.name));
  CLIPS = ONLY.length ? ALL_CLIPS.filter((c) => ONLY.indexOf(c.name.split('-')[0]) !== -1) : ALL_CLIPS;
  if (!CLIPS.length) throw new Error('No clips match --only ' + ONLY.join(','));
}
// variants.json lists every clip that exists on disk, so the listening page keeps showing earlier batches too.
function writeManifest() {
  const have = ALL_CLIPS.filter((c) => VARIANTS.some((v) => fs.existsSync(path.join(OUT_DIR, v.id, c.name + '.wav'))));
  fs.writeFileSync(path.join(OUT_DIR, 'variants.json'), JSON.stringify({ model: MODEL, variants: VARIANTS, clips: have }, null, 2));
}


let keyIdx = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function request(text, voice, style) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: style ? style + ' ' + text : text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } }
      }
    });
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: '/v1beta/models/' + encodeURIComponent(MODEL) + ':generateContent',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-goog-api-key': KEYS[keyIdx]
      }
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(60000, () => req.destroy(new Error('timeout')));
    req.write(body);
    req.end();
  });
}

function retryDelay(body, attempt) {
  const m = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(body || '');
  return m ? Math.ceil(Number(m[1]) * 1000) + 1000 : 15000 * attempt;
}

async function synth(text, voice, style) {
  let last = 'unknown error';
  let switches = 0;
  for (let attempt = 1; attempt <= 4; attempt++) {
    let wait = 0;
    try {
      const r = await request(text, voice, style);
      if (r.status === 200) {
        const j = JSON.parse(r.body);
        const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
        const p = parts.find((x) => x.inlineData && x.inlineData.data);
        if (p) {
          const m = /rate=(\d+)/.exec(p.inlineData.mimeType || '');
          return { pcm: Buffer.from(p.inlineData.data, 'base64'), rate: m ? Number(m[1]) : 24000 };
        }
        last = 'no audio in response';
        wait = 5000 * attempt;
      } else {
        let msg = r.body.slice(0, 200);
        try { msg = JSON.parse(r.body).error.message || msg; } catch (e) { /* keep raw */ }
        last = 'HTTP ' + r.status + ': ' + msg;
        const more = KEYS.length > 1 && switches < KEYS.length - 1;
        if ((r.status === 429 || r.status === 401 || r.status === 403) && more) {
          switches++;
          keyIdx = (keyIdx + 1) % KEYS.length;
          attempt--;
          console.log('    switching to key ' + (keyIdx + 1) + ' of ' + KEYS.length + ' (' + last.slice(0, 70) + ')');
          continue;
        }
        if (r.status === 429 || r.status >= 500) wait = retryDelay(r.body, attempt);
        else return { error: last, fatal: r.status !== 400 };
      }
    } catch (e) {
      last = 'network: ' + e.message;
      wait = 5000 * attempt;
    }
    if (attempt < 4) {
      console.log('    attempt ' + attempt + ' failed (' + last.slice(0, 80) + '), retrying in ' + Math.round(wait / 1000) + 's');
      await sleep(wait);
    }
  }
  return { error: last, fatal: false };
}

function wav(pcm, rate) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(pcm.length + 36, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

async function main() {
  if (!KEYS.length) { console.error('No API key'); return 2; }
  await loadClips();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  VARIANTS.forEach((v) => fs.mkdirSync(path.join(OUT_DIR, v.id), { recursive: true }));
  writeManifest();
  const total = CLIPS.length * VARIANTS.length;
  console.log('clips: ' + CLIPS.length + ' | variants: ' + VARIANTS.length + ' | total files: ' + total + ' | model: ' + MODEL + ' | keys: ' + KEYS.length);
  console.log('output: ' + path.resolve(OUT_DIR) + '\n');
  let ok = 0;
  let skipped = 0;
  let n = 0;
  const failed = [];
  let called = false;
  // Clips in the outer loop: if the run stops early, every voice already has the first clips to compare.
  outer:
  for (const c of CLIPS) {
    for (const v of VARIANTS) {
      n++;
      const tag = '[' + n + '/' + total + ']';
      const file = path.join(OUT_DIR, v.id, c.name + '.wav');
      if (fs.existsSync(file) && fs.statSync(file).size > 44) { console.log('exists ' + tag + ' ' + v.id + '/' + c.name); skipped++; continue; }
      if (called && DELAY_MS > 0) await sleep(DELAY_MS);
      called = true;
      const out = await synth(c.send, v.voice, v.style);
      if (out.error) {
        console.error('ERR ' + tag + ' ' + v.id + '/' + c.name + ': ' + out.error);
        failed.push({ variant: v.id, name: c.name, error: out.error });
        if (out.fatal) { console.error('This will not fix itself by retrying. Stopping. Check the key / model name / voice name and run again.'); break outer; }
        continue;
      }
      fs.writeFileSync(file + '.part', wav(out.pcm, out.rate));
      fs.renameSync(file + '.part', file);
      console.log('OK ' + tag + ' ' + v.id + '/' + c.name);
      ok++;
    }
  }
  console.log('\nok: ' + ok + ' | skipped: ' + skipped + ' | failed: ' + failed.length);
  if (failed.length) {
    fs.writeFileSync(path.join(OUT_DIR, '_errors.json'), JSON.stringify(failed, null, 2));
    console.log('errors saved to ' + path.join(OUT_DIR, '_errors.json') + ' (run again to retry)');
  }
  writeManifest();
  console.log('done: ' + path.resolve(OUT_DIR));
  return failed.length ? 1 : 0;
}

main().then((c) => process.exit(c)).catch((e) => { console.error('Fatal: ' + e.message); process.exit(3); });
