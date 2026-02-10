/**
 * Nova Demo — Generate TTS Audio + Merge with Video
 *
 * Reads the timing manifest from demo-record.mjs, generates narration audio
 * using ElevenLabs TTS, and merges with the recorded video using ffmpeg.
 *
 * Run: node scripts/demo-audio.mjs
 *
 * Requires: ELEVENLABS_API_KEY in .env or environment
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Read .env file manually
const envFile = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf-8');
const envVars = Object.fromEntries(
  envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => {
    const [k, ...v] = l.split('=');
    return [k.trim(), v.join('=').trim().replace(/^["']|["']$/g, '')];
  })
);

const OUTPUT_DIR = '/tmp/nova-demo-recording';
const AUDIO_DIR = path.join(OUTPUT_DIR, 'audio-segments');
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'timing.json');

const API_KEY = envVars.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error('ELEVENLABS_API_KEY not set. Add it to .env or export it.');
  process.exit(1);
}

// Voice config — Eric: smooth, trustworthy, american, conversational
const VOICE_ID = 'cjVigY5qzO86Huf0OWal';
const MODEL_ID = 'eleven_turbo_v2_5';

fs.mkdirSync(AUDIO_DIR, { recursive: true });

// ── Load manifest ──
if (!fs.existsSync(MANIFEST_PATH)) {
  console.error(`Timing manifest not found at ${MANIFEST_PATH}`);
  console.error('Run "node scripts/demo-record.mjs" first.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
console.log(`📋 Loaded manifest: ${manifest.segments.length} segments, ${(manifest.totalDurationMs / 1000).toFixed(1)}s total`);
console.log(`🎥 Video: ${manifest.videoFile}\n`);

// ── Generate TTS for each segment ──
async function generateTTS(text, outputPath) {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      voice_settings: {
        stability: 0.6,
        similarity_boost: 0.8,
        style: 0.3,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} — ${err}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

function getAudioDuration(filePath) {
  const output = execSync(
    `ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`,
    { encoding: 'utf-8' }
  ).trim();
  return parseFloat(output) * 1000; // ms
}

console.log('🎙  Generating narration audio segments...\n');

const audioSegments = [];

for (let i = 0; i < manifest.segments.length; i++) {
  const seg = manifest.segments[i];
  const audioFile = path.join(AUDIO_DIR, `seg-${String(i).padStart(2, '0')}-${seg.key}.mp3`);

  process.stdout.write(`  [${i + 1}/${manifest.segments.length}] ${seg.key}...`);

  if (fs.existsSync(audioFile)) {
    // Reuse cached audio
    const duration = getAudioDuration(audioFile);
    audioSegments.push({ ...seg, audioFile, audioDurationMs: duration });
    console.log(` cached (${(duration / 1000).toFixed(1)}s)`);
    continue;
  }

  try {
    await generateTTS(seg.text, audioFile);
    const duration = getAudioDuration(audioFile);
    audioSegments.push({ ...seg, audioFile, audioDurationMs: duration });
    console.log(` ${(duration / 1000).toFixed(1)}s`);
  } catch (err) {
    console.log(` ERROR: ${err.message}`);
    audioSegments.push({ ...seg, audioFile: null, audioDurationMs: 0 });
  }

  // Small delay to respect rate limits
  await new Promise(r => setTimeout(r, 200));
}

console.log(`\n✓ Generated ${audioSegments.filter(s => s.audioFile).length} audio segments`);

// ── Build merged audio track using ffmpeg ──
console.log('\n🔧 Building merged audio track...\n');

// First, convert video to mp4 if it's webm
const videoFile = manifest.videoFile;
const videoExt = path.extname(videoFile);
let mp4Video = videoFile;

if (videoExt === '.webm') {
  mp4Video = path.join(OUTPUT_DIR, 'demo-video.mp4');
  console.log('  Converting WebM → MP4...');
  execSync(`ffmpeg -y -i "${videoFile}" -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p "${mp4Video}"`, { stdio: 'inherit' });
  console.log('  ✓ Video converted\n');
}

// Get video duration
const videoDuration = getAudioDuration(mp4Video);
console.log(`  Video duration: ${(videoDuration / 1000).toFixed(1)}s`);

// Build ffmpeg command to overlay all audio segments at their timestamps
// Strategy: use adelay to position each segment, then amix all together
const validSegments = audioSegments.filter(s => s.audioFile);

if (validSegments.length === 0) {
  console.error('No audio segments generated. Cannot merge.');
  process.exit(1);
}

// Build the ffmpeg filter graph
let inputs = `-i "${mp4Video}"`;
let filterParts = [];
let mixInputs = [];

for (let i = 0; i < validSegments.length; i++) {
  const seg = validSegments[i];
  const inputIdx = i + 1; // 0 is the video
  inputs += ` -i "${seg.audioFile}"`;

  // adelay: delay in ms for left and right channels
  const delayMs = Math.max(0, Math.round(seg.startMs));
  filterParts.push(`[${inputIdx}]adelay=${delayMs}|${delayMs},apad[a${i}]`);
  mixInputs.push(`[a${i}]`);
}

const filterComplex = filterParts.join(';') +
  `;${mixInputs.join('')}amix=inputs=${validSegments.length}:duration=longest:dropout_transition=0,volume=${validSegments.length}[aout]`;

const outputFile = path.join(OUTPUT_DIR, 'nova-demo-final.mp4');

const ffmpegCmd = `ffmpeg -y ${inputs} -filter_complex "${filterComplex}" -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k -shortest "${outputFile}"`;

console.log('\n  Merging video + audio...');
try {
  execSync(ffmpegCmd, { stdio: 'inherit', maxBuffer: 50 * 1024 * 1024 });
  console.log(`\n✅ Final video: ${outputFile}`);
} catch (err) {
  console.error('\nffmpeg merge failed. Trying simpler approach...');

  // Fallback: concatenate all audio segments sequentially with silence gaps
  const concatList = path.join(AUDIO_DIR, 'concat.txt');
  let concatContent = '';
  let currentMs = 0;

  for (const seg of validSegments) {
    // Add silence gap if needed
    const gap = seg.startMs - currentMs;
    if (gap > 100) {
      const silenceFile = path.join(AUDIO_DIR, `silence-${currentMs}.mp3`);
      execSync(`ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=stereo -t ${(gap / 1000).toFixed(3)} -c:a libmp3lame "${silenceFile}"`);
      concatContent += `file '${silenceFile}'\n`;
      currentMs += gap;
    }
    concatContent += `file '${seg.audioFile}'\n`;
    currentMs += seg.audioDurationMs;
  }

  fs.writeFileSync(concatList, concatContent);

  const mergedAudio = path.join(AUDIO_DIR, 'merged-narration.mp3');
  execSync(`ffmpeg -y -f concat -safe 0 -i "${concatList}" -c:a libmp3lame -b:a 192k "${mergedAudio}"`);

  execSync(`ffmpeg -y -i "${mp4Video}" -i "${mergedAudio}" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest "${outputFile}"`, { stdio: 'inherit' });
  console.log(`\n✅ Final video (fallback): ${outputFile}`);
}

// ── Print summary ──
console.log('\n══════════════════════════════════');
console.log('DEMO VIDEO GENERATION COMPLETE');
console.log('══════════════════════════════════');
console.log(`📁 Output directory: ${OUTPUT_DIR}`);
console.log(`🎥 Final video: ${outputFile}`);
console.log(`📋 Timing manifest: ${MANIFEST_PATH}`);
console.log(`🎙  Audio segments: ${AUDIO_DIR}/`);
console.log(`\nPlay: open "${outputFile}"`);
