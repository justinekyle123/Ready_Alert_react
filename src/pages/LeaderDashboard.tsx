// src/pages/LeaderDashboard.tsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useActiveAlert } from '../hooks/useActiveAlert';
import { useMembers } from '../hooks/useMembers';
import { HeaderBar } from '../components/HeaderBar';
import { AlertBanner } from '../components/AlertBanner';
import { TriAlarmPanel } from '../components/TriAlarmPanel';
import { AlertHistoryPanel } from '../components/AlertHistoryPanel';
import { BottomNav, NavTab } from '../components/BottomNav';
import { updateUserEmergencyStatus } from '../services/userService';
import { EmergencyStatus } from '../@types';
import { 
  Users, 
  CheckCircle, 
  AlertTriangle, 
  PhoneCall, 
  Radio, 
  LifeBuoy, 
  ShieldAlert,
  UserCheck
} from 'lucide-react';

export const LeaderDashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const groupId = userProfile?.groupId || 'GRP-001';
  const { currentAlert } = useActiveAlert(groupId);
  const { members, stats } = useMembers(groupId);

  const [activeTab, setActiveTab] = useState<NavTab>('alarm');
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);

  if (!userProfile) return null;

  const handleUpdateMemberStatus = async (memberId: string, status: EmergencyStatus) => {
    setUpdatingMemberId(memberId);
    try {
      await updateUserEmergencyStatus(memberId, status);
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingMemberId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <HeaderBar />

      <main className="max-w-md md:max-w-4xl mx-auto px-4 pt-4 space-y-5">
        {/* Active Alert Banner - First Page Only */}
        {activeTab === 'alarm' && (
          <AlertBanner alert={currentAlert} userRole={userProfile.role} />
        )}

        {/* Tri-Alarm Emergency Transmitter Panel (Leader core feature - First Page) */}
        {activeTab === 'alarm' && (
          <TriAlarmPanel
            userRole={userProfile.role}
            userId={userProfile.uid}
            userName={userProfile.name}
            groupId={groupId}
          />
        )}

        {/* Recent Alerts Log with Date Filter (Alerts Tab) */}
        {activeTab === 'overview' && (
          <AlertHistoryPanel 
            userRole={userProfile.role}
            userGroupId={groupId}
          />
        )}

        {/* Group Member Roster (My Members Tab) */}
        {activeTab === 'members' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-5 shadow-xl space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Assigned Group Members ({stats.total})</span>
              </h3>
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 bg-slate-950 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border border-slate-800 flex-shrink-0">
                Group: {groupId}
              </span>
            </div>

            {/* Members List */}
            <div className="space-y-2 pt-1">
              {members.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500 italic bg-slate-950 rounded-xl border border-slate-800">
                  No members assigned to this group yet.
                </div>
              ) : (
                members.map((m) => (
                  <div
                    key={m.memberId}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-2.5"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-100 flex items-center gap-1.5 flex-wrap">
                        <span>{m.name}</span>
                        {m.contactNumber && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({m.contactNumber})
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] sm:text-[11px] text-slate-400">{m.email}</div>
                    </div>

                    <span className="text-[10px] font-bold bg-slate-900 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-800">
                      Member
                    </span>
                  </div>
                ))
              )}
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
