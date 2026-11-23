import { fromVector, query } from '../db/pool.js';
import type { Profile } from './score.js';

export async function loadProfile(userId: number): Promise<Profile> {
  const [interests, users] = await Promise.all([
    query('SELECT topic, embedding::text AS embedding FROM interests WHERE user_id = $1 ORDER BY id', [userId]),
    query('SELECT taste::text AS taste FROM users WHERE id = $1', [userId]),
  ]);
  return {
    interests: interests.map((i) => ({ topic: i.topic, vector: fromVector(i.embedding)! })),
    taste: fromVector(users[0]?.taste ?? null),
  };
}
