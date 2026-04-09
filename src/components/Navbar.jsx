import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LiveBadge from './LiveBadge';
import { LogOut } from 'lucide-react';

const navLinks = [
  { path: '/', label: 'Dashboard' },
  { path: '/daily', label: 'Daily Report' },
  { path: '/monthly', label: 'Monthly Report' },
  { path: '/providers', label: 'Providers' },
];

export default function Navbar() {
  const { user, signOut } = useAuth();
  const location = useLocation();

  return (
    <nav style={{
      background: '#1a1f36',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 56,
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em' }}>
          NU<span style={{ color: '#818cf8' }}>dashboard</span>
        </span>

        <div style={{ display: 'flex', gap: 4 }}>
          {navLinks.map(({ path, label }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                style={{
                  color: active ? '#fff' : '#94a3b8',
                  textDecoration: 'none',
                  padding: '4px 12px',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                  background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <LiveBadge />
        {user && (
          <button
            onClick={signOut}
            title="Sign out"
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 13,
              padding: '4px 8px',
              borderRadius: 6,
            }}
          >
            <LogOut size={14} />
            Sign out
          </button>
        )}
      </div>
    </nav>
  );
}
