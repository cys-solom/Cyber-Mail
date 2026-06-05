'use client';

import { Search, Bell, LogOut, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function Topbar() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const handleLogout = async () => {
    await fetch('/api/auth/login', { method: 'DELETE' });
    router.push('/login');
    router.refresh();
  };

  const iconBtn = (): React.CSSProperties => ({
    width: 44, height: 44, borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: '#94a3b8', transition: 'all 0.2s',
  });

  return (
    <header style={{
      height: 76, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px',
      borderBottom: '1px solid rgba(59,130,246,0.06)',
      background: 'rgba(255,255,255,0.65)',
      backdropFilter: 'blur(20px)',
    }}>
      {/* Search */}
      <div style={{ flex: 1, maxWidth: 500 }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, color: '#94a3b8' }} />
          <input type="text" placeholder="Search accounts, emails, codes..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '14px 20px 14px 50px',
              background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(59,130,246,0.1)',
              borderRadius: 14, fontSize: 15, color: '#1e293b', outline: 'none',
              transition: 'all 0.2s', fontWeight: 500,
            }}
            onFocus={(e) => { e.target.style.borderColor = 'rgba(59,130,246,0.25)'; e.target.style.background = 'rgba(255,255,255,0.85)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'rgba(59,130,246,0.1)'; e.target.style.background = 'rgba(255,255,255,0.5)'; }}
          />
        </div>
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 24 }}>
        {/* Ready Badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 18px', borderRadius: 100, marginRight: 8,
          background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)',
        }}>
          <div style={{ width: 8, height: 8, background: '#10b981', borderRadius: '50%', boxShadow: '0 0 8px rgba(16,185,129,0.5)' }} />
          <span style={{ fontSize: 12, fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ready</span>
        </div>

        <button style={{ ...iconBtn(), position: 'relative' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.06)'; e.currentTarget.style.color = '#2563eb'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}>
          <Bell style={{ width: 22, height: 22 }} />
          <span style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, background: '#2563eb', borderRadius: '50%' }} />
        </button>

        <button style={iconBtn()}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.06)'; e.currentTarget.style.color = '#475569'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}>
          <User style={{ width: 22, height: 22 }} />
        </button>

        <button onClick={handleLogout} title="Logout" style={iconBtn()}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; e.currentTarget.style.color = '#ef4444'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}>
          <LogOut style={{ width: 22, height: 22 }} />
        </button>
      </div>
    </header>
  );
}
