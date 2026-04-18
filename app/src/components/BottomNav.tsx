import { useNavigate, useLocation } from 'react-router-dom';
import { Trophy, User, Zap, Calendar } from 'lucide-react';

const navItems = [
  { path: '/', label: '순위', icon: Trophy },
  { path: '/batters', label: '타자', icon: User },
  { path: '/pitchers', label: '투수', icon: Zap },
  { path: '/games', label: '경기', icon: Calendar },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        const Icon = item.icon;
        return (
          <button
            key={item.path}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <Icon size={22} color={isActive ? '#3182F6' : '#B0B8C1'} strokeWidth={isActive ? 2.4 : 1.8} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
