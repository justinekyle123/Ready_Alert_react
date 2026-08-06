// src/components/RoleBadge.tsx
import React from 'react';
import { UserRole } from '../@types';
import { Shield, Users, User } from 'lucide-react';

interface RoleBadgeProps {
  role: UserRole;
  size?: 'sm' | 'md' | 'lg';
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, size = 'md' }) => {
  const getBadgeStyle = () => {
    switch (role) {
      case 'HOST':
        return {
          bg: 'bg-purple-100 text-purple-900 border-purple-300',
          icon: <Shield className="w-4 h-4 mr-1 text-purple-700" />,
          label: 'Host (HQ)'
        };
      case 'YOUTH_LEADER':
        return {
          bg: 'bg-blue-100 text-blue-900 border-blue-300',
          icon: <Users className="w-4 h-4 mr-1 text-blue-700" />,
          label: 'Youth Volunteer Leader'
        };
      case 'MEMBER':
      default:
        return {
          bg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
          icon: <User className="w-4 h-4 mr-1 text-emerald-700" />,
          label: 'Volunteer Member'
        };
    }
  };

  const config = getBadgeStyle();
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : size === 'lg' ? 'px-3 py-1.5 text-sm font-semibold' : 'px-2.5 py-1 text-xs font-medium';

  return (
    <span className={`inline-flex items-center rounded-full border ${config.bg} ${sizeClasses}`}>
      {config.icon}
      {config.label}
    </span>
  );
};
