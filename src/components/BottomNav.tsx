// src/components/BottomNav.tsx
import React from 'react';
import { UserRole } from '../@types';
import { 
  ShieldAlert, 
  Users, 
  Radio, 
  Building2, 
  Bell, 
  UserCheck,
  LayoutDashboard,
  Home
} from 'lucide-react';

export type NavTab = 'home' | 'overview' | 'alarm' | 'members' | 'groups' | 'status' | 'network' | 'alerts';

interface BottomNavProps {
  role: UserRole;
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  hasActiveAlert?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  role,
  activeTab,
  onSelectTab,
  hasActiveAlert = false
}) => {
  const renderNavItems = () => {
    switch (role) {
      case 'HOST':
        return [
          {
            id: 'overview' as NavTab,
            label: 'Overview',
            icon: <LayoutDashboard className="w-5 h-5" />
          },
          {
            id: 'alerts' as NavTab,
            label: 'Alerts',
            icon: <Bell className="w-5 h-5" />
          },
          {
            id: 'alarm' as NavTab,
            label: 'Backup Alarm',
            icon: <ShieldAlert className={`w-5 h-5 ${hasActiveAlert ? 'text-red-400 animate-pulse' : ''}`} />
          },
          {
            id: 'groups' as NavTab,
            label: 'Groups',
            icon: <Building2 className="w-5 h-5" />
          },
          {
            id: 'members' as NavTab,
            label: 'Users',
            icon: <Users className="w-5 h-5" />
          }
        ];

      case 'YOUTH_LEADER':
        return [
          {
            id: 'home' as NavTab,
            label: 'Home',
            icon: <Home className="w-5 h-5" />
          },
          {
            id: 'alarm' as NavTab,
            label: 'Tri-Alarm',
            icon: <Radio className={`w-5 h-5 ${hasActiveAlert ? 'text-red-400 animate-pulse' : ''}`} />
          },
          {
            id: 'members' as NavTab,
            label: 'My Members',
            icon: <UserCheck className="w-5 h-5" />
          },
          {
            id: 'overview' as NavTab,
            label: 'Alerts Log',
            icon: <Bell className="w-5 h-5" />
          }
        ];

      case 'MEMBER':
      default:
        return [
          {
            id: 'home' as NavTab,
            label: 'Home',
            icon: <Home className="w-5 h-5" />
          },
          {
            id: 'alarm' as NavTab,
            label: 'Alerts Log',
            icon: <Bell className={`w-5 h-5 ${hasActiveAlert ? 'text-red-400 animate-pulse' : ''}`} />
          },
          {
            id: 'network' as NavTab,
            label: 'Group Net',
            icon: <Users className="w-5 h-5" />
          }
        ];
    }
  };

  const items = renderNavItems();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 p-2 sm:p-3 pointer-events-none pb-[calc(env(safe-area-inset-bottom)+8px)]">
      <div className="max-w-md md:max-w-lg mx-auto bg-slate-900/90 backdrop-blur-2xl border border-slate-800/90 rounded-2xl sm:rounded-3xl shadow-2xl shadow-black/80 pointer-events-auto flex items-center justify-around p-1.5 ring-1 ring-white/5">
        {items.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex-1 min-h-[48px] py-1.5 px-1 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center transition-all duration-200 active:scale-95 relative ${
                isActive
                  ? 'bg-slate-800/90 text-red-400 font-extrabold shadow-inner border border-slate-700/60'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 font-medium'
              }`}
            >
              <div className="relative">
                {item.icon}
                {item.id === 'alarm' && hasActiveAlert && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-1 leading-none font-bold">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

