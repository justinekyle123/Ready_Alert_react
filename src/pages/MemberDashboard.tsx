// src/pages/MemberDashboard.tsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useActiveAlert } from '../hooks/useActiveAlert';
import { useMembers } from '../hooks/useMembers';
import { HeaderBar } from '../components/HeaderBar';
import { AlertBanner } from '../components/AlertBanner';
import { AlertHistoryPanel } from '../components/AlertHistoryPanel';
import { BottomNav, NavTab } from '../components/BottomNav';
import { 
  Users, 
  Bell
} from 'lucide-react';

export const MemberDashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const groupId = userProfile?.groupId || 'GRP-001';
  const { currentAlert } = useActiveAlert(groupId);
  const { members } = useMembers(groupId);

  const [activeTab, setActiveTab] = useState<NavTab>('alarm');

  if (!userProfile) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <HeaderBar />

      <main className="max-w-md mx-auto px-4 pt-4 space-y-5">
        {/* Real-time Alert Banner - First Page Only */}
        {activeTab === 'alarm' && (
          <AlertBanner alert={currentAlert} userRole={userProfile.role} />
        )}

        {/* Emergency Alerts Log with Date Filter */}
        {activeTab === 'alarm' && (
          <AlertHistoryPanel 
            userRole={userProfile.role}
            userGroupId={groupId}
          />
        )}

        {/* Peer Members Summary in Group */}
        {activeTab === 'network' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Group Member Network ({members.length})</span>
              </h3>
              <span className="text-[10px] text-slate-400 font-bold">Group: {groupId}</span>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {members.map((m) => {
                let badgeStyle = 'bg-slate-800 text-slate-300 border-slate-700';
                let badgeText = 'MEMBER';

                if (m.emergencyStatus === 'SAFE') {
                  badgeStyle = 'bg-emerald-950 text-emerald-300 border-emerald-700';
                  badgeText = 'SAFE';
                } else if (m.emergencyStatus === 'NEED_ASSISTANCE') {
                  badgeStyle = 'bg-amber-950 text-amber-300 border-amber-700';
                  badgeText = 'NEED ASSISTANCE';
                } else if (m.emergencyStatus === 'IN_DANGER') {
                  badgeStyle = 'bg-red-950 text-red-300 border-red-700 animate-pulse';
                  badgeText = 'IN DANGER';
                }

                return (
                  <div
                    key={m.memberId}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-200">{m.name}</div>
                      <div className="text-[10px] text-slate-400">{m.email}</div>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-black rounded border ${badgeStyle}`}>
                      {badgeText}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <BottomNav
        role={userProfile.role}
        activeTab={activeTab}
        onSelectTab={(t) => setActiveTab(t)}
        hasActiveAlert={!!currentAlert}
      />
    </div>
  );
};
