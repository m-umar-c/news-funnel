import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import WhyPanel from '../components/WhyPanel';
import { api, type ThreadResponse } from '../lib/api';
import { useAuth } from '../lib/auth';
import { clockTime, hostOf, plural, timeAgo } from '../lib/format';
import { useAsync } from '../lib/useAsync';

export default function Story() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, error, loading, setData } = useAsync(() => api.get<ThreadResponse>(`/threads/${id}`), [id, user?.id]);
  const [active, setActive] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  if (loading && !data) return <p className="loading">Loading story</p>;
  if (error || !data) return <p className="empty">{error ?? 'Story not found'}</p>;

  const { thread, articles, summary, why } = data;
  const cited = new Set(summary?.bullets.flatMap((b) => b.sources) ?? []);
  const visibleSentences = summary ? summary.sentences.map((s, i) => ({ s, n: i + 1 })).filter((x) => showAll || cited.has(x.n)) : [];
  const leadArticle = articles.find((a) => a.id === summary?.articleId);

  async function vote(value: 1 | -1) {
    if (!user) return navigate('/sign-in');
    const next = thread.myFeedback === value ? null : value;
    await api.post(`/threads/${thread.id}/feedback`, { value: next ?? 0 });
    setData({ ...data!, thread: { ...thread, myFeedback: next } });
  }

  return (
    <article className="story">
      <div>
        <p className="label kicker">
          <Link to="/">Stories</Link> / {plural(thread.sourceCount, 'outlet')}
        </p>
        <h1>{thread.title}</h1>
        <div className="story-meta label">
          <span>First reported {clockTime(thread.firstSeenAt)}</span>
          <span>Updated {timeAgo(thread.lastSeenAt)}</span>
          <span>{plural(thread.articleCount, 'article')}</span>
          <span className="thumbs" style={{ marginLeft: 'auto' }}>
            <button className="thumb up" aria-pressed={thread.myFeedback === 1} onClick={() => vote(1)}>More like this</button>
            <button className="thumb down" aria-pressed={thread.myFeedback === -1} onClick={() => vote(-1)}>Less</button>
          </span>
        </div>

        {summary ? (
          <section>
            <h3 className="label section-title" style={{ marginTop: 0 }}>Summary</h3>
            <ul className="bullets">
              {summary.bullets.map((b, i) => (
                <li key={i}>
                  {b.text}
                  {b.sources.map((n) => (
                    <button key={n} className={`cite ${active === n ? 'on' : ''}`} onClick={() => setActive(active === n ? null : n)} aria-label={`Source sentence ${n}`}>
                      [{n}]
                    </button>
                  ))}
                </li>
              ))}
            </ul>
            <div className="verify label">
              <span className="ok">
                {summary.validation.accepted} of {summary.validation.proposed} {summary.validation.proposed === 1 ? 'claim' : 'claims'} checked against the article
              </span>
              <span>{summary.method === 'llm' ? `written by ${summary.model}` : 'extracted from the article text'}</span>
              {leadArticle && <span>from {leadArticle.source}</span>}
            </div>
            {summary.validation.rejected.length > 0 && (
              <ul className="rejected">
                {summary.validation.rejected.map((r, i) => (
                  <li key={i}>
                    {r.text && <>Dropped: “{r.text}”</>}
                    <span className="why">{r.reason}</span>
                  </li>
                ))}
              </ul>
            )}

            <h3 className="label section-title">Source sentences</h3>
            <ol className="evidence">
              {visibleSentences.map(({ s, n }) => (
                <li key={n} className={`${cited.has(n) ? 'cited' : ''} ${active === n ? 'active' : ''}`} onClick={() => setActive(active === n ? null : n)}>
                  <span className="n">[{n}]</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            {summary.sentences.length > cited.size && (
              <button className="btn ghost small" style={{ marginTop: 10 }} onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Show cited sentences only' : `Show all ${summary.sentences.length} sentences`}
              </button>
            )}
          </section>
        ) : (
          <p className="notice">No summary was generated for this story.</p>
        )}

        <h3 className="label section-title">Coverage timeline</h3>
        <ol className="coverage">
          {articles.map((a) => (
            <li key={a.id}>
              <span className="label">
                {a.source} · {clockTime(a.published_at)}
              </span>
              <a href={a.url} target="_blank" rel="noreferrer noopener">
                {a.title}
              </a>
              <p>{a.snippet.length > 180 ? `${a.snippet.slice(0, 180).trimEnd()}…` : a.snippet} <span className="label">{hostOf(a.url)}</span></p>
            </li>
          ))}
        </ol>
      </div>

      <aside className="side">
        {why ? (
          <WhyPanel why={why} />
        ) : (
          <p className="notice" style={{ marginTop: 0 }}>
            {user ? (
              <>Follow some <Link to="/topics">topics</Link> to see how this story scores for you.</>
            ) : (
              <><Link to="/sign-in">Sign in</Link> to see how this story scores against your interests.</>
            )}
          </p>
        )}
      </aside>
    </article>
  );
}
