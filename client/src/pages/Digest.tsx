import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { api, type DigestItem, type Team } from '../lib/api';
import { plural, timeAgo } from '../lib/format';
import { useAsync } from '../lib/useAsync';

export default function Digest() {
  const { slug } = useParams();
  const [hours, setHours] = useState(48);
  const [copied, setCopied] = useState(false);
  const teams = useAsync(() => api.get<{ teams: Team[] }>('/teams'), []);
  const digest = useAsync(
    () => (slug ? api.get<{ team: Team; items: DigestItem[] }>(`/teams/${slug}/digest?hours=${hours}`) : Promise.resolve(null)),
    [slug, hours],
  );

  if (!slug && teams.data?.teams[0]) return <Navigate to={`/digest/${teams.data.teams[0].slug}`} replace />;

  async function copyMarkdown() {
    const res = await fetch(`/api/teams/${slug}/digest.md?hours=${hours}`);
    await navigator.clipboard.writeText(await res.text());
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const team = digest.data?.team;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="label kicker">Team digests</p>
          <h1>{team?.name ?? 'Digest'}</h1>
        </div>
        {slug && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select aria-label="Time window" value={hours} onChange={(e) => setHours(Number(e.target.value))} style={{ width: 'auto' }}>
              <option value={24}>Last 24 hours</option>
              <option value={48}>Last 48 hours</option>
              <option value={72}>Last 3 days</option>
              <option value={168}>Last week</option>
            </select>
            <button className="btn ghost small" onClick={copyMarkdown}>{copied ? 'Copied' : 'Copy as Markdown'}</button>
          </div>
        )}
      </div>
      {team && <p className="deck">Ranked against: {team.topics.join('; ')}.</p>}

      <div className="tabs" role="tablist">
        {teams.data?.teams.map((t) => (
          <Link key={t.id} to={`/digest/${t.slug}`} className={`tab ${t.slug === slug ? 'active' : ''}`}>
            {t.name}
          </Link>
        ))}
      </div>

      {digest.loading && !digest.data && <p className="loading">Building digest</p>}
      {digest.error && <p className="error">{digest.error}</p>}
      {digest.data && digest.data.items.length === 0 && <p className="empty">Nothing matched these topics in this window.</p>}

      <ol className="digest-list">
        {digest.data?.items.map((it) => (
          <li key={it.id}>
            <div>
              <h3>
                <Link to={`/story/${it.id}`}>{it.title}</Link>
              </h3>
              {it.lede && <p className="lede">{it.lede}</p>}
              <div className="meta label">
                <span>{plural(it.sourceCount, 'outlet')}: {it.sources.slice(0, 3).join(', ')}</span>
                <span className="sep">{timeAgo(it.lastSeenAt)}</span>
                {it.topic && <span className="sep">matches “{it.topic}”</span>}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
