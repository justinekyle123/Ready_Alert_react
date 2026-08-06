// src/components/BottomNav.tsx
import React from 'react';
import { UserRole } from '../@types';
import { 
  ShieldAlert, 
  Users, 
  Radio, 
  Building2, 
  HeartHandshake, 
  Bell, 
  UserCheck,
  LayoutDashboard
} from 'lucide-react';

export type NavTab = 'overview' | 'alarm' | 'members' | 'groups' | 'status' | 'network' | 'alerts';

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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 shadow-2xl">
      <div className="max-w-md md:max-w-4xl mx-auto px-2 flex items-center justify-around">
        {items.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex-1 min-h-[56px] py-1.5 px-1 flex flex-col items-center justify-center transition-all duration-200 active:scale-95 ${
                isActive
                  ? 'text-red-400 font-extrabold border-t-2 border-red-500 bg-red-950/20'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <div className="relative">
                {item.icon}
                {item.id === 'alarm' && hasActiveAlert && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-1">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
