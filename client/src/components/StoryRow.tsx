import { Link, useNavigate } from 'react-router-dom';
import { api, type FeedItem } from '../lib/api';
import { useAuth } from '../lib/auth';
import { plural, timeAgo } from '../lib/format';

interface Props {
  item: FeedItem;
  rank: number;
  onChange: (id: number, value: 1 | -1 | null) => void;
}

export default function StoryRow({ item, rank, onChange }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();

  async function vote(value: 1 | -1) {
    if (!user) return navigate('/sign-in');
    const next = item.myFeedback === value ? null : value;
    const prev = item.myFeedback;
    onChange(item.id, next);
    try {
      await api.post(`/threads/${item.id}/feedback`, { value: next ?? 0 });
    } catch {
      onChange(item.id, prev);
    }
  }

  return (
    <li className="row">
      <span className="rank">{String(rank).padStart(2, '0')}</span>
      <div>
        <h2>
          <Link to={`/story/${item.id}`}>{item.title}</Link>
        </h2>
        {item.lede && <p className="lede">{item.lede}</p>}
        <div className="meta label">
          {item.sourceCount > 1 && <span className="badge">{plural(item.sourceCount, 'outlet')}</span>}
          <span>{item.sources.slice(0, 3).join(', ')}{item.sources.length > 3 ? ` +${item.sources.length - 3}` : ''}</span>
          <span className="sep">{timeAgo(item.lastSeenAt)}</span>
          {item.articleCount > 1 && <span className="sep">{plural(item.articleCount, 'article')}</span>}
          {item.topic && <span className="sep">matches “{item.topic}”</span>}
          <span className="thumbs">
            <button className="thumb up" aria-pressed={item.myFeedback === 1} onClick={() => vote(1)} title="Show me more like this">
              More like this
            </button>
            <button className="thumb down" aria-pressed={item.myFeedback === -1} onClick={() => vote(-1)} title="Hide this and show fewer like it">
              Less
            </button>
          </span>
        </div>
      </div>
    </li>
  );
}
