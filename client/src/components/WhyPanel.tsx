import type { ThreadResponse } from '../lib/api';

export default function WhyPanel({ why }: { why: NonNullable<ThreadResponse['why']> }) {
  return (
    <section>
      <h3 className="label section-title" style={{ marginTop: 0 }}>Why it ranks here</h3>
      <table className="ledger">
        <tbody>
          {why.components.map((c) => (
            <tr key={c.key}>
              <td>
                {c.label}
                {c.detail && <span className="d">{c.detail}</span>}
                <span className="bar" aria-hidden>
                  <i className={c.points < 0 ? 'neg' : ''} style={{ width: `${Math.min(100, Math.abs(c.raw) * 100)}%` }} />
                </span>
              </td>
              <td className="pts">{c.points >= 0 ? '+' : ''}{c.points.toFixed(2)}</td>
            </tr>
          ))}
          <tr className="total">
            <td>Score</td>
            <td className="pts">{why.score.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
      {why.evidence && (
        <blockquote className="quote">
          {why.evidence.sentence}
          <span className="label" style={{ display: 'block', marginTop: 6 }}>Closest passage to “{why.topic}”</span>
        </blockquote>
      )}
    </section>
  );
}
