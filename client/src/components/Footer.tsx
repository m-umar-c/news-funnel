import { api, type Stats } from '../lib/api';
import { timeAgo } from '../lib/format';
import { useAsync } from '../lib/useAsync';

export default function Footer() {
  const { data } = useAsync(() => api.get<Stats>('/stats'), []);
  return (
    <footer className="label">
      <span>
        {data ? `${data.threads} stories from ${data.articles} articles across ${data.sources} sources` : 'News Funnel'}
      </span>
      <span>{data?.last_ingest ? `Last fetch ${timeAgo(data.last_ingest)}` : 'Waiting for the first fetch'}</span>
    </footer>
  );
}
