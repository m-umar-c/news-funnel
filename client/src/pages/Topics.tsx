import { FormEvent, useState } from 'react';
import { api, type Team } from '../lib/api';
import { useAsync } from '../lib/useAsync';

interface Interest {
  id: number;
  topic: string;
}

export default function Topics() {
  const interests = useAsync(() => api.get<{ interests: Interest[] }>('/interests'), []);
  const teams = useAsync(() => api.get<{ teams: Team[] }>('/teams'), []);
  const [topic, setTopic] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  async function add(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post('/interests', { topic });
      setTopic('');
      interests.reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleTeam(t: Team) {
    if (t.joined) await api.del(`/teams/${t.slug}/join`);
    else await api.post(`/teams/${t.slug}/join`);
    teams.reload();
  }

  async function resetTaste() {
    if (!window.confirm('Clear everything you have rated? Your followed topics stay.')) return;
    await api.del('/interests/taste');
    setResetMsg('Ratings cleared.');
  }

  return (
    <>
      <div className="page-head">
        <div>
          <p className="label kicker">Your topics</p>
          <h1>What you follow</h1>
        </div>
      </div>
      <p className="deck">Write topics the way you would say them. Matching is by meaning, so “databases” also finds a story about indexes and query plans.</p>

      <div className="two-col" style={{ marginTop: 32 }}>
        <section>
          <h3 className="label section-title" style={{ marginTop: 0 }}>Topics</h3>
          <form className="inline-form" onSubmit={add}>
            <label className="field">
              <span className="label">Add a topic</span>
              <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. rust and systems programming" maxLength={80} required minLength={2} />
            </label>
            <button className="btn" disabled={busy || topic.trim().length < 2}>{busy ? 'Adding' : 'Add'}</button>
          </form>
          {error && <p className="error">{error}</p>}

          {interests.data?.interests.length === 0 && <p className="empty" style={{ padding: '28px 0' }}>Nothing yet.</p>}
          <ul className="topic-list">
            {interests.data?.interests.map((i) => (
              <li key={i.id}>
                <span>{i.topic}</span>
                <button
                  className="btn ghost small"
                  onClick={async () => {
                    await api.del(`/interests/${i.id}`);
                    interests.reload();
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>

          <h3 className="label section-title">Ratings</h3>
          <p style={{ fontSize: 16, color: 'var(--ink-2)', margin: '0 0 12px' }}>
            Every “more like this” and “less” you click adjusts a separate taste profile on top of your topics.
          </p>
          <button className="btn ghost small" onClick={resetTaste}>Clear my ratings</button>
          {resetMsg && <span className="label" style={{ marginLeft: 12 }}>{resetMsg}</span>}
        </section>

        <section>
          <h3 className="label section-title" style={{ marginTop: 0 }}>Teams</h3>
          {teams.data?.teams.map((t) => (
            <div className="team-card" key={t.id}>
              <div>
                <h3>{t.name}</h3>
                <p>{t.topics.join(' · ')}</p>
                <span className="label">{t.members} {t.members === 1 ? 'member' : 'members'}</span>
              </div>
              <button className={`btn small ${t.joined ? 'ghost' : ''}`} onClick={() => toggleTeam(t)}>
                {t.joined ? 'Leave' : 'Join'}
              </button>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
