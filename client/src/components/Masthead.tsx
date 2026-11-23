import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { dateline } from '../lib/format';

export default function Masthead() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="masthead">
      <div className="masthead-top">
        <Link to="/" className="wordmark">
          News <em>Funnel</em>
        </Link>
        <span className="label">{dateline()}</span>
      </div>
      <hr className="masthead-rule" />
      <nav className="nav" aria-label="Main">
        <NavLink to="/" end>Stories</NavLink>
        <NavLink to="/digest">Team digests</NavLink>
        {user && <NavLink to="/topics">Your topics</NavLink>}
        {user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
        <span className="spacer" />
        {user ? (
          <>
            <span>{user.name}</span>
            <button
              onClick={async () => {
                await logout();
                navigate('/');
              }}
            >
              Sign out
            </button>
          </>
        ) : (
          <NavLink to="/sign-in">Sign in</NavLink>
        )}
      </nav>
    </header>
  );
}
