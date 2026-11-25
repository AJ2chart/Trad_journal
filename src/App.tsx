import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import Journal from './pages/Journal';
import TradeDetail from './pages/TradeDetail';
import Stats from './pages/Stats';
import Lessons from './pages/Lessons';
import SettingsPage from './pages/Settings';

const NAV = [
  { to: '/', label: 'Journal', icon: 'M4 5h16M4 12h16M4 19h10' },
  { to: '/stats', label: 'Stats', icon: 'M5 20V10M12 20V4M19 20v-7' },
  { to: '/lecons', label: 'Leçons', icon: 'M5 4h11l3 3v13H5zM9 10h6M9 14h6' },
  { to: '/reglages', label: 'Réglages', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 12h2M18 12h2M12 4v2M12 18v2' },
];

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="./icon.svg" alt="" width={26} height={26} />
          <span>Trad Journal</span>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className="nav-link">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
                <path d={n.icon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<Journal />} />
          <Route path="/trade/:id" element={<TradeDetail />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/lecons" element={<Lessons />} />
          <Route path="/reglages" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
