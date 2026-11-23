import { config } from './config.js';
import { runIngest } from './pipeline/ingest.js';

const interval = config.INGEST_INTERVAL_MINUTES * 60_000;

async function tick() {
  const started = Date.now();
  try {
    const stats = await runIngest('schedule');
    if (!stats) console.log('ingest skipped, another run holds the lock');
    else console.log(`ingest done in ${Math.round((Date.now() - started) / 1000)}s`, stats);
  } catch (err) {
    console.error('ingest failed', err);
  }
}

console.log(`worker started, running every ${config.INGEST_INTERVAL_MINUTES} minutes`);
await tick();
setInterval(tick, interval);
