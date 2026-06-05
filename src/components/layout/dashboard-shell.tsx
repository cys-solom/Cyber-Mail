'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { SidebarProvider, useSidebar } from '@/lib/sidebar-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { width } = useSidebar();

  return (
    <div style={{
      marginLeft: width,
      transition: 'margin-left 0.3s cubic-bezier(0.4,0,0.2,1)',
      minHeight: '100vh',
    }}>
      <Topbar />
      <main style={{ minHeight: 'calc(100vh - 76px)' }}>
        {children}
      </main>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    // Check if admin_session cookie exists
    const hasSession = document.cookie.includes('is_logged_in');
    if (!hasSession) {
      router.push('/login');
      return;
    }
    setAuthenticated(true);
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
              animation: 'glow-pulse 2s ease-in-out infinite',
              boxShadow: '0 8px 32px rgba(37,99,235,0.2)',
            }} />
          </div>
          <p style={{ fontSize: 15, color: '#64748b', fontWeight: 600 }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) return null;

  return (
    <SidebarProvider>
      <div style={{ minHeight: '100vh' }}>
        <Sidebar />
        <DashboardContent>{children}</DashboardContent>
      </div>
    </SidebarProvider>
  );
}
