import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function SignIn() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'in') await login(email, password);
      else await register(name, email, password);
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth" onSubmit={submit}>
      <h1>{mode === 'in' ? 'Sign in' : 'Create an account'}</h1>
      {mode === 'up' && (
        <label className="field">
          <span className="label">Name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} autoComplete="name" />
        </label>
      )}
      <label className="field">
        <span className="label">Email</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </label>
      <label className="field">
        <span className="label">Password</span>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === 'up' ? 8 : 1} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
      </label>
      {mode === 'up' && <p className="label" style={{ marginTop: -6 }}>At least 8 characters. The first account on a fresh install becomes the admin.</p>}
      <button className="btn" disabled={busy}>{busy ? 'One moment' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
      {error && <p className="error">{error}</p>}
      <p className="switch">
        {mode === 'in' ? 'New here? ' : 'Already registered? '}
        <button type="button" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError(null); }}>
          {mode === 'in' ? 'Create an account' : 'Sign in'}
        </button>
      </p>
    </form>
  );
}
