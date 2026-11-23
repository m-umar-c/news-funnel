import { FormEvent, useEffect, useState } from 'react';
import { api, type RunRow, type SourceRow, type Team } from '../lib/api';
import { clockTime, timeAgo } from '../lib/format';
import { useAsync } from '../lib/useAsync';

export default function Admin() {
  const sources = useAsync(() => api.get<{ sources: SourceRow[] }>('/admin/sources'), []);
  const runs = useAsync(() => api.get<{ runs: RunRow[] }>('/admin/runs'), []);
  const teams = useAsync(() => api.get<{ teams: Team[] }>('/teams'), []);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = runs.data?.runs[0] && !runs.data.runs[0].finished_at;

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      runs.reload();
      sources.reload();
    }, 4000);
    return () => clearInterval(t);
  }, [running]);

  async function guard(fn: () => Promise<unknown>) {
    setError(null);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const startIngest = () =>
    guard(async () => {
      await api.post('/admin/ingest');
      setMsg('Fetch started. This page refreshes while it runs.');
      setTimeout(runs.reload, 800);
    });

  const [form, setForm] = useState({ name: '', url: '', kind: 'rss', weight: 1 });
  const addSource = (e: FormEvent) => {
    e.preventDefault();
    guard(async () => {
      await api.post('/admin/sources', { ...form, weight: Number(form.weight) });
      setForm({ name: '', url: '', kind: 'rss', weight: 1 });
      sources.reload();
    });
  };

  const [team, setTeam] = useState({ name: '', topics: '' });
  const addTeam = (e: FormEvent) => {
    e.preventDefault();
    guard(async () => {
      await api.post('/teams', { name: team.name, topics: team.topics.split(',').map((t) => t.trim()).filter(Boolean) });
      setTeam({ name: '', topics: '' });
      teams.reload();
    });
  };

  return (
    <>
      <div className="page-head">
        <div>
          <p className="label kicker">Admin</p>
          <h1>Sources and fetching</h1>
        </div>
        <button className="btn" onClick={startIngest} disabled={Boolean(running)}>{running ? 'Fetching' : 'Run fetch now'}</button>
      </div>
      {msg && <p className="notice">{msg}</p>}
      {error && <p className="error">{error}</p>}

      <h3 className="label section-title">Sources</h3>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>Name</th><th>Type</th><th>Weight</th><th>Articles</th><th>Last fetch</th><th /></tr>
          </thead>
          <tbody>
            {sources.data?.sources.map((s) => (
              <tr key={s.id}>
                <td>
                  {s.name}
                  <span className="label" style={{ display: 'block', wordBreak: 'break-all' }}>{s.url}</span>
                  {s.last_error && <span className="err">{s.last_error}</span>}
                </td>
                <td className="num">{s.kind}</td>
                <td className="num">
                  <input
                    type="number" min={0} max={2} step={0.1} defaultValue={s.weight} aria-label={`Weight for ${s.name}`}
                    style={{ width: 60, fontSize: 14 }}
                    onBlur={(e) => Number(e.target.value) !== s.weight && guard(async () => { await api.patch(`/admin/sources/${s.id}`, { weight: Number(e.target.value) }); sources.reload(); })}
                  />
                </td>
                <td className="num">{s.articles}</td>
                <td className="num">{s.last_fetched_at ? timeAgo(s.last_fetched_at) : 'never'}</td>
                <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                  <button className="btn ghost small" onClick={() => guard(async () => { await api.patch(`/admin/sources/${s.id}`, { enabled: !s.enabled }); sources.reload(); })}>
                    {s.enabled ? 'Disable' : 'Enable'}
                  </button>{' '}
                  <button className="btn ghost small danger" onClick={() => window.confirm(`Remove ${s.name} and its articles?`) && guard(async () => { await api.del(`/admin/sources/${s.id}`); sources.reload(); })}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="inline-form" onSubmit={addSource} style={{ marginTop: 24 }}>
        <label className="field"><span className="label">Name</span><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
        <label className="field" style={{ flex: '2 1 300px' }}><span className="label">Feed URL</span><input type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} required placeholder="https://example.com/feed.xml" /></label>
        <label className="field" style={{ flex: '0 1 110px' }}>
          <span className="label">Type</span>
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}><option value="rss">RSS / Atom</option><option value="hn">HN API</option></select>
        </label>
        <button className="btn">Add source</button>
      </form>

      <h3 className="label section-title">Recent fetches</h3>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Started</th><th>Trigger</th><th>Fetched</th><th>New</th><th>Joined threads</th><th>Errors</th></tr></thead>
          <tbody>
            {runs.data?.runs.map((r) => (
              <tr key={r.id}>
                <td className="num">{clockTime(r.started_at)}{!r.finished_at && ' (running)'}</td>
                <td className="num">{r.trigger}</td>
                <td className="num">{r.fetched}</td>
                <td className="num">{r.inserted}</td>
                <td className="num">{r.clustered}</td>
                <td>{r.errors.length === 0 ? <span className="num">none</span> : r.errors.map((e, i) => <span className="err" key={i}>{e.source}: {e.message}</span>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="label section-title">Teams</h3>
      {teams.data?.teams.map((t) => (
        <div className="team-card" key={t.id}>
          <div><h3>{t.name}</h3><p>{t.topics.join(' · ')}</p></div>
          <button className="btn ghost small danger" onClick={() => window.confirm(`Delete the ${t.name} team?`) && guard(async () => { await api.del(`/teams/${t.slug}`); teams.reload(); })}>Delete</button>
        </div>
      ))}
      <form className="inline-form" onSubmit={addTeam} style={{ marginTop: 20 }}>
        <label className="field" style={{ flex: '1 1 180px' }}><span className="label">Team name</span><input type="text" value={team.name} onChange={(e) => setTeam({ ...team, name: e.target.value })} required /></label>
        <label className="field" style={{ flex: '3 1 320px' }}><span className="label">Topics, comma separated</span><input type="text" value={team.topics} onChange={(e) => setTeam({ ...team, topics: e.target.value })} required placeholder="mobile development, ios and android" /></label>
        <button className="btn">Add team</button>
      </form>
    </>
  );
}
