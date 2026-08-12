// src/pages/MemberDashboard.tsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useActiveAlert } from '../hooks/useActiveAlert';
import { useMembers } from '../hooks/useMembers';
import { useGroupData } from '../hooks/useGroupData';
import { HeaderBar } from '../components/HeaderBar';
import { AlertBanner } from '../components/AlertBanner';
import { AlertHistoryPanel } from '../components/AlertHistoryPanel';
import { MemberHomeView } from '../components/MemberHomeView';
import { BottomNav, NavTab } from '../components/BottomNav';
import { Users, Crown, ShieldCheck, Phone, Mail } from 'lucide-react';

export const MemberDashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const groupId = userProfile?.groupId || 'GRP-001';
  const { currentAlert } = useActiveAlert(groupId);
  const { members, leaders } = useMembers(groupId);
  const { groups } = useGroupData();

  const [activeTab, setActiveTab] = useState<NavTab>('home');

  if (!userProfile) return null;

  const currentGroup = groups.find(g => g.groupId === groupId);

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
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-4">
              {/* Header card */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-400" />
                    <span>Group Network Roster</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {currentGroup?.organizationName || userProfile?.organizationName || 'Volunteer Response Network'}
                  </p>
                </div>
                <span className="text-[10px] text-slate-300 font-bold bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 font-mono">
                  Group: {groupId}
                </span>
              </div>

              {/* Assigned Group Leaders Section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span>Assigned Youth Leader{leaders.length > 1 ? 's' : ''} ({leaders.length})</span>
                  </h4>
                  <span className="text-[9px] font-bold text-amber-400 bg-amber-950/80 border border-amber-800/60 px-2 py-0.5 rounded-md uppercase tracking-wide">
                    Leader HQ
                  </span>
                </div>

                {leaders.length === 0 ? (
                  currentGroup?.leaderName ? (
                    <div className="p-3.5 bg-gradient-to-r from-blue-950/40 via-slate-950 to-slate-950 border border-blue-800/50 rounded-2xl flex items-center justify-between gap-3 shadow-sm">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-blue-900/80 text-blue-200 font-black text-xs flex items-center justify-center border border-blue-700 shadow-inner shrink-0">
                          {currentGroup.leaderName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-100 truncate">{currentGroup.leaderName}</span>
                            <span className="px-2 py-0.5 text-[9px] font-extrabold rounded-lg bg-blue-900/80 text-blue-300 border border-blue-700/80 shrink-0">
                              YOUTH LEADER
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate mt-0.5">
                            Assigned to {currentGroup.organizationName || groupId}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-slate-950/80 border border-slate-800/80 rounded-2xl text-center space-y-1">
                      <p className="text-xs text-slate-400 font-medium">No Youth Leader explicitly assigned to this group yet.</p>
                      <p className="text-[10px] text-slate-500">Contact HQ Administration (host@readyalert.org) for assistance.</p>
                    </div>
                  )
                ) : (
                  leaders.map((leader) => (
                    <div
                      key={leader.uid}
                      className="p-3.5 bg-gradient-to-r from-blue-950/50 via-slate-950 to-slate-950 border border-blue-800/60 rounded-2xl flex items-center justify-between gap-3 shadow-md hover:border-blue-700/80 transition"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-blue-900/90 text-blue-200 font-black text-xs flex items-center justify-center border border-blue-600 shadow-md shrink-0">
                          {leader.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-slate-100">{leader.name}</span>
                            <span className="px-2 py-0.5 text-[9px] font-black rounded-lg bg-blue-900 text-blue-200 border border-blue-700 uppercase tracking-wide shrink-0">
                              YOUTH LEADER
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-300 flex items-center gap-1 truncate">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <a href={`mailto:${leader.email}`} className="hover:underline hover:text-blue-300 truncate">
                              {leader.email}
                            </a>
                          </div>
                          {leader.contactNumber && (
                            <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                              <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                              <a href={`tel:${leader.contactNumber}`} className="hover:underline hover:text-emerald-300">
                                {leader.contactNumber}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>

                      {leader.contactNumber && (
                        <a
                          href={`tel:${leader.contactNumber}`}
                          className="px-2.5 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded-xl text-[10px] font-bold flex items-center gap-1 shrink-0 transition active:scale-95 shadow"
                          title="Call Leader"
                        >
                          <Phone className="w-3 h-3 text-emerald-400" />
                          <span className="hidden sm:inline">Call</span>
                        </a>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Volunteer Group Members Section */}
              <div className="space-y-2.5 pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Volunteer Members ({members.length})</span>
                  </h4>
                </div>

                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {members.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-500 italic bg-slate-950 rounded-2xl border border-slate-800">
                      No volunteer members in this group yet.
                    </div>
                  ) : (
                    members.map((m) => (
                      <div
                        key={m.memberId}
                        className="p-3 bg-slate-950 border border-slate-800/80 rounded-2xl flex items-center justify-between gap-3 hover:border-slate-700 transition"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-slate-800 text-slate-200 font-black text-xs flex items-center justify-center border border-slate-700 shadow-inner shrink-0">
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-100 truncate">{m.name}</div>
                            <div className="text-[10px] text-slate-400 truncate">{m.email}</div>
                            {m.contactNumber && m.contactNumber !== 'N/A' && (
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                                <Phone className="w-2.5 h-2.5 text-slate-500" />
                                <span>{m.contactNumber}</span>
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


