// src/pages/MemberDashboard.tsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useActiveAlert } from '../hooks/useActiveAlert';
import { useMembers } from '../hooks/useMembers';
import { HeaderBar } from '../components/HeaderBar';
import { AlertBanner } from '../components/AlertBanner';
import { AlertHistoryPanel } from '../components/AlertHistoryPanel';
import { MemberHomeView } from '../components/MemberHomeView';
import { BottomNav, NavTab } from '../components/BottomNav';
import { Users } from 'lucide-react';

export const MemberDashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const groupId = userProfile?.groupId || 'GRP-001';
  const { currentAlert } = useActiveAlert(groupId);
  const { members } = useMembers(groupId);

  const [activeTab, setActiveTab] = useState<NavTab>('home');

  if (!userProfile) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <HeaderBar />

      <main className="max-w-md md:max-w-4xl mx-auto px-4 pt-4 space-y-5">
        {/* Home Page Tab View */}
        {activeTab === 'home' && (
          <MemberHomeView
            userProfile={userProfile}
            currentAlert={currentAlert}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {/* Real-time Alert Banner & Log (Alerts Log Tab) */}
        {activeTab === 'alarm' && (
          <>
            <AlertBanner alert={currentAlert} userRole={userProfile.role} />
            <AlertHistoryPanel 
              userRole={userProfile.role}
              userGroupId={groupId}
            />
          </>
        )}

        {/* Group Member Network Tab View */}
        {activeTab === 'network' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Group Member Network ({members.length})</span>
              </h3>
              <span className="text-[10px] text-slate-400 font-bold bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
                Group: {groupId}
              </span>
            </div>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {members.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500 italic bg-slate-950 rounded-2xl border border-slate-800">
                  No volunteer members in this group yet.
                </div>
              ) : (
                members.map((m) => (
                  <div
                    key={m.memberId}
                    className="p-3 bg-slate-950 border border-slate-800/80 rounded-2xl flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-full bg-slate-800 text-slate-200 font-black text-xs flex items-center justify-center border border-slate-700 shadow-inner">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-100">{m.name}</div>
                        <div className="text-[10px] text-slate-400">{m.email}</div>
                        {m.contactNumber && (
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            📞 {m.contactNumber}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 text-[10px] font-extrabold rounded-xl bg-slate-900 text-slate-300 border border-slate-800 shrink-0">
                      VOLUNTEER
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

