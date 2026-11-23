import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import StoryRow from '../components/StoryRow';
import { api, type FeedItem, type FeedResponse } from '../lib/api';
import { useAuth } from '../lib/auth';

const PAGE = 25;

export default function Feed() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const scope = params.get('scope') === 'latest' ? 'latest' : 'for-you';

  const [items, setItems] = useState<FeedItem[]>([]);
  const [total, setTotal] = useState(0);
  const [personalised, setPersonalised] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (offset: number) => {
      setLoading(true);
      try {
        const res = await api.get<FeedResponse>(`/feed?scope=${scope}&limit=${PAGE}&offset=${offset}`);
        setItems((prev) => (offset === 0 ? res.items : [...prev, ...res.items]));
        setTotal(res.total);
        setPersonalised(res.personalised);
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [scope, user?.id],
  );

  useEffect(() => {
    setItems([]);
    load(0);
  }, [load]);

  const patch = (id: number, value: 1 | -1 | null) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, myFeedback: value } : i)));

  return (
    <>
      <div className="page-head">
        <div>
          <p className="label kicker">Today’s stories</p>
          <h1>One story, every outlet</h1>
        </div>
      </div>
      <p className="deck">Coverage of the same event is grouped together, summarised from the source text, and ranked against what you follow.</p>

      <div className="tabs" role="tablist">
        <button className="tab" role="tab" aria-selected={scope === 'for-you'} onClick={() => setParams({})}>
          {personalised || user ? 'For you' : 'Top'}
        </button>
        <button className="tab" role="tab" aria-selected={scope === 'latest'} onClick={() => setParams({ scope: 'latest' })}>
          Latest
        </button>
      </div>

      {scope === 'for-you' && !user && (
        <p className="notice">
          This is the general ranking. <Link to="/sign-in">Sign in</Link> and choose topics to rank stories for you.
        </p>
      )}
      {scope === 'for-you' && user && !personalised && !loading && (
        <p className="notice">
          You have not picked anything to follow yet. Add a few <Link to="/topics">topics</Link> and this list will reorder itself.
        </p>
      )}

      {error && <p className="error">{error}</p>}
      {loading && items.length === 0 && <p className="loading">Loading stories</p>}
      {!loading && !error && items.length === 0 && (
        <p className="empty">No stories yet. An admin can run a fetch from the Admin page, or wait for the next scheduled run.</p>
      )}

      <ol className="feed">
        {items.map((item, i) => (
          <StoryRow key={item.id} item={item} rank={i + 1} onChange={patch} />
        ))}
      </ol>

      {items.length < total && (
        <button className="btn ghost more" disabled={loading} onClick={() => load(items.length)}>
          {loading ? 'Loading' : `Show more (${total - items.length} left)`}
        </button>
      )}
    </>
  );
}
