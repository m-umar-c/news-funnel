import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Masthead from './components/Masthead';
import Footer from './components/Footer';
import { useAuth } from './lib/auth';
import Feed from './pages/Feed';
import Story from './pages/Story';
import Digest from './pages/Digest';
import Topics from './pages/Topics';
import Admin from './pages/Admin';
import SignIn from './pages/SignIn';

function Protected({ children, admin = false }: { children: ReactElement; admin?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="loading">Loading</p>;
  if (!user) return <Navigate to="/sign-in" replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <div className="shell">
      <Masthead />
      <main>
        <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/story/:id" element={<Story />} />
          <Route path="/digest" element={<Digest />} />
          <Route path="/digest/:slug" element={<Digest />} />
          <Route path="/topics" element={<Protected><Topics /></Protected>} />
          <Route path="/admin" element={<Protected admin><Admin /></Protected>} />
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="*" element={<p className="empty">That page does not exist.</p>} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
