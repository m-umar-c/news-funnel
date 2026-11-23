import { pool } from '../db/pool.js';
import { runIngest } from './ingest.js';

runIngest('cli')
  .then((stats) => {
    console.log(stats ?? 'another ingest run is already in progress');
    return pool.end();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
