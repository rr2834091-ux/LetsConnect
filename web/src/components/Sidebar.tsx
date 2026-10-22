import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Bell,
  MessageSquare,
  Users,
  Calendar,
  Phone,
  Settings
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export const Sidebar: React.FC = () => {
  const navItems: NavItem[] = [
    { to: '/activity', label: 'Activity', icon: <Bell size={20} /> },
    { to: '/chat', label: 'Chat', icon: <MessageSquare size={20} /> },
    { to: '/teams', label: 'Teams', icon: <Users size={20} /> },
    { to: '/meetings', label: 'Calendar', icon: <Calendar size={20} /> },
    { to: '/calls', label: 'Calls', icon: <Phone size={20} /> },
  ];

  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      height: 'calc(100vh - var(--topbar-height))',
      backgroundColor: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 0',
      userSelect: 'none',
      zIndex: 10,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: '10px 0',
              textDecoration: 'none',
              color: isActive ? 'var(--brand-light)' : 'var(--text-secondary)',
              position: 'relative',
              transition: 'background-color 0.15s',
              backgroundColor: isActive ? 'var(--bg-hover)' : 'transparent',
            })}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: '3px',
                    backgroundColor: 'var(--brand-primary)',
                    borderRadius: '0 2px 2px 0',
                  }} />
                )}
                {item.icon}
                <span style={{ fontSize: '11px', fontWeight: isActive ? 600 : 400 }}>
                  {item.label}
                </span>
                {Boolean(item.badge && item.badge > 0) && (
                  <span style={{
                    position: 'absolute',
                    top: '6px',
                    right: '14px',
                    backgroundColor: 'var(--danger)',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: 700,
                    borderRadius: '10px',
                    padding: '1px 5px',
                  }}>
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>

      <div style={{ width: '100%' }}>
        <NavLink
          to="/settings"
          style={({ isActive }) => ({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '10px 0',
            textDecoration: 'none',
            color: isActive ? 'var(--brand-light)' : 'var(--text-secondary)',
            position: 'relative',
          })}
        >
          <Settings size={20} />
          <span style={{ fontSize: '11px' }}>Settings</span>
        </NavLink>
      </div>
    </aside>
  );
};
