'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from '@/lib/constants';
import { useSidebar } from '@/lib/sidebar-context';
import {
  LayoutDashboard, Mail, Upload, Crosshair,
  ListOrdered, ScrollText, Settings, ChevronLeft,
  ChevronRight, Store
} from 'lucide-react';

const iconMap: Record<string, any> = {
  LayoutDashboard, Mail, Upload, Crosshair,
  ListOrdered, ScrollText, Settings,
};

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle, width } = useSidebar();

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0,
      width, height: '100vh', zIndex: 40,
      display: 'flex', flexDirection: 'column',
      background: 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(24px)',
      borderRight: '1px solid rgba(59,130,246,0.08)',
      transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
      overflow: 'hidden',
      boxShadow: '2px 0 12px rgba(0,0,0,0.03)',
    }}>
      {/* ═══ Header ═══ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: collapsed ? '0 20px' : '0 24px',
        height: 76,
        borderBottom: '1px solid rgba(59,130,246,0.06)',
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14, flexShrink: 0,
          background: 'linear-gradient(135deg, #2563eb, #3b82f6, #60a5fa)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(37,99,235,0.2)',
        }}>
          <Mail style={{ width: 22, height: 22, color: 'white' }} />
        </div>
        {!collapsed && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b', whiteSpace: 'nowrap', letterSpacing: '-0.3px' }}>
              Diaa Store
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8', whiteSpace: 'nowrap', marginTop: 2 }}>
              Mail Dashboard
            </div>
          </div>
        )}
      </div>

      {/* ═══ Navigation ═══ */}
      <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = iconMap[item.icon];
            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center',
                  gap: 14,
                  padding: collapsed ? '14px 0' : '14px 18px',
                  borderRadius: 14,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  background: isActive ? 'rgba(37,99,235,0.08)' : 'transparent',
                  borderLeft: isActive ? '3px solid #2563eb' : '3px solid transparent',
                  ...(isActive ? { boxShadow: '0 0 16px rgba(37,99,235,0.04)' } : {}),
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(59,130,246,0.04)'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <Icon style={{
                    width: 22, height: 22, flexShrink: 0,
                    color: isActive ? '#2563eb' : '#94a3b8',
                    transition: 'color 0.2s',
                  }} />
                  {!collapsed && (
                    <span style={{
                      fontSize: 15, fontWeight: isActive ? 700 : 500,
                      color: isActive ? '#2563eb' : '#64748b',
                      whiteSpace: 'nowrap', transition: 'color 0.2s', letterSpacing: '-0.2px',
                    }}>
                      {item.label}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ═══ Collapse ═══ */}
      <div style={{ padding: '12px 12px 16px', borderTop: '1px solid rgba(59,130,246,0.06)' }}>
        <button onClick={toggle} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          padding: '12px 0', borderRadius: 12,
          background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.08)',
          color: '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.08)'; e.currentTarget.style.color = '#2563eb'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.04)'; e.currentTarget.style.color = '#94a3b8'; }}
        >
          {collapsed ? <ChevronRight style={{ width: 18, height: 18 }} /> : (
            <><ChevronLeft style={{ width: 18, height: 18 }} /> Collapse</>
          )}
        </button>
      </div>
    </aside>
  );
}
