// src/pages/HostDashboard.tsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useActiveAlert } from '../hooks/useActiveAlert';
import { useGroupData } from '../hooks/useGroupData';
import { useAllUsers } from '../hooks/useAllUsers';
import { HeaderBar } from '../components/HeaderBar';
import { AlertBanner } from '../components/AlertBanner';
import { TriAlarmPanel } from '../components/TriAlarmPanel';
import { AlertHistoryPanel } from '../components/AlertHistoryPanel';
import { BottomNav, NavTab } from '../components/BottomNav';
import { createVolunteerGroup, updateVolunteerGroup, deleteVolunteerGroup } from '../services/groupService';
import { createNewUserByHost, updateUserProfile, deleteUserProfile, updateUserGroupAssignment } from '../services/userService';
import { confirmDeleteAlert, showSuccessToast, showErrorAlert } from '../utils/sweetalert';
import { UserProfile, UserRole, Group } from '../@types';
import { 
  Shield, 
  Users, 
  Search, 
  Building2, 
  PlusCircle, 
  UserPlus, 
  ArrowRightLeft, 
  X, 
  Check, 
  UserCheck,
  Edit2,
  Trash2,
  Eye,
  Crown,
  Mail,
  Phone
} from 'lucide-react';

export const HostDashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const { currentAlert } = useActiveAlert();
  const { groups } = useGroupData();
  const { users } = useAllUsers();

  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Group Modal States
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [viewingGroupDetails, setViewingGroupDetails] = useState<Group | null>(null);

  // User Modal States
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [selectedUserToReassign, setSelectedUserToReassign] = useState<UserProfile | null>(null);

  // Group Form State
  const [newGroupId, setNewGroupId] = useState('');
  const [newOrgName, setNewOrgName] = useState('');
  const [newLeaderName, setNewLeaderName] = useState('');
  const [selectedLeaderUid, setSelectedLeaderUid] = useState('');
  const [selectedMemberUids, setSelectedMemberUids] = useState<string[]>([]);
  const [memberPickerUid, setMemberPickerUid] = useState<string>('');
  const [groupSubmitting, setGroupSubmitting] = useState(false);

  // Filter actual youth leaders and members registered in system
  const youthLeaders = users.filter(u => u.role === 'YOUTH_LEADER');
  const allMembers = users.filter(u => u.role === 'MEMBER');

  // Available youth leaders for Create Group (exclude leaders already assigned to an existing active group)
  const availableLeadersForCreate = youthLeaders.filter(u => {
    const isAssignedByGroupId = Boolean(u.groupId && groups.some(g => g.groupId === u.groupId));
    const isAssignedByName = groups.some(g => g.leaderName === u.name);
    return !isAssignedByGroupId && !isAssignedByName;
  });

  // Available youth leaders for Edit Group (allow currently assigned leader for this group, exclude leaders assigned to other groups)
  const getAvailableLeadersForEdit = (targetGroup: Group) => {
    return youthLeaders.filter(u => {
      const isCurrentlyAssignedToThisGroup =
        (targetGroup.groupId && u.groupId === targetGroup.groupId) ||
        (targetGroup.leaderName && u.name === targetGroup.leaderName) ||
        u.uid === selectedLeaderUid;

      if (isCurrentlyAssignedToThisGroup) return true;

      const isAssignedToOtherByGroupId = Boolean(u.groupId && groups.some(g => g.groupId === u.groupId && g.groupId !== targetGroup.groupId));
      const isAssignedToOtherByName = groups.some(g => g.leaderName === u.name && g.groupId !== targetGroup.groupId);

      return !isAssignedToOtherByGroupId && !isAssignedToOtherByName;
    });
  };

  // User Form State
  const [uName, setUName] = useState('');
  const [uEmail, setUEmail] = useState('');
  const [uRole, setURole] = useState<UserRole>('MEMBER');
  const [uContact, setUContact] = useState('');
  const [uGroupId, setUGroupId] = useState('GRP-001');
  const [uOrgName, setUOrgName] = useState('');
  const [userSubmitting, setUserSubmitting] = useState(false);

  // Reassignment Form State
  const [targetGroupId, setTargetGroupId] = useState('');
  const [reassignSubmitting, setReassignSubmitting] = useState(false);

  if (!userProfile) return null;

  // Group CRUD Handlers
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setGroupSubmitting(true);
    try {
      const gId = newGroupId.trim() || `GRP-${Math.floor(100 + Math.random() * 900)}`;
      
      const chosenLeader = youthLeaders.find(u => u.uid === selectedLeaderUid);
      const chosenLeaderName = chosenLeader?.name || newLeaderName.trim() || 'Unassigned Leader';

      await createVolunteerGroup({
        groupId: gId,
        organizationName: newOrgName.trim(),
        leaderName: chosenLeaderName,
        memberCount: selectedMemberUids.length
      });

      if (chosenLeader) {
        await updateUserGroupAssignment(chosenLeader.uid, gId, newOrgName.trim());
      }

      // Assign all selected members to this group
      for (const mUid of selectedMemberUids) {
        await updateUserGroupAssignment(mUid, gId, newOrgName.trim());
      }

      setShowCreateGroupModal(false);
      setNewGroupId('');
      setNewOrgName('');
      setSelectedLeaderUid('');
      setNewLeaderName('');
      setSelectedMemberUids([]);
      setMemberPickerUid('');
      showSuccessToast('Volunteer Group Created');
    } catch (err) {
      console.error(err);
      showErrorAlert('Create Failed', 'Failed to create volunteer group.');
    } finally {
      setGroupSubmitting(false);
    }
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup || !newOrgName.trim()) return;
    setGroupSubmitting(true);
    try {
      const chosenLeader = youthLeaders.find(u => u.uid === selectedLeaderUid);
      const chosenLeaderName = chosenLeader?.name || newLeaderName.trim() || editingGroup.leaderName || 'Unassigned Leader';

      await updateVolunteerGroup(editingGroup.groupId, {
        organizationName: newOrgName.trim(),
        leaderName: chosenLeaderName,
        memberCount: selectedMemberUids.length
      });

      if (chosenLeader) {
        await updateUserGroupAssignment(chosenLeader.uid, editingGroup.groupId, newOrgName.trim());
      }

      // Sync member group assignments
      const previousMemberUids = users.filter(u => u.role === 'MEMBER' && u.groupId === editingGroup.groupId).map(u => u.uid);

      for (const mUid of selectedMemberUids) {
        await updateUserGroupAssignment(mUid, editingGroup.groupId, newOrgName.trim());
      }

      // Unassign members who were removed in the edit modal
      const removedMemberUids = previousMemberUids.filter(uid => !selectedMemberUids.includes(uid));
      for (const mUid of removedMemberUids) {
        await updateUserGroupAssignment(mUid, '', '');
      }

      setEditingGroup(null);
      setNewOrgName('');
      setSelectedLeaderUid('');
      setNewLeaderName('');
      setSelectedMemberUids([]);
      setMemberPickerUid('');
      showSuccessToast('Volunteer Group Updated');
    } catch (err) {
      console.error(err);
      showErrorAlert('Update Failed', 'Failed to update volunteer group.');
    } finally {
      setGroupSubmitting(false);
    }
  };

  const handleDeleteGroup = async (groupId: string, orgName: string) => {
    const confirmed = await confirmDeleteAlert(
      'Delete Volunteer Group?',
      `Are you sure you want to delete "${orgName}" (${groupId})? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await deleteVolunteerGroup(groupId);
      showSuccessToast('Group Deleted');
    } catch (err) {
      console.error(err);
      showErrorAlert('Delete Failed', 'Could not delete group. Please check database permissions.');
    }
  };

  // User CRUD Handlers
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uName.trim() || !uEmail.trim()) return;
    setUserSubmitting(true);
    try {
      const matchedGroup = groups.find(g => g.groupId === uGroupId);
      await createNewUserByHost({
        name: uName.trim(),
        email: uEmail.trim(),
        role: uRole,
        contactNumber: uContact.trim(),
        groupId: uGroupId,
        organizationName: uOrgName.trim() || matchedGroup?.organizationName || 'Metro Volunteer Group'
      });
      setShowCreateUserModal(false);
      setUName('');
      setUEmail('');
      setUContact('');
      showSuccessToast('User Registered Successfully');
    } catch (err) {
      console.error(err);
      showErrorAlert('Registration Failed', 'Failed to create user account.');
    } finally {
      setUserSubmitting(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !uName.trim() || !uEmail.trim()) return;
    setUserSubmitting(true);
    try {
      const matchedGroup = groups.find(g => g.groupId === uGroupId);
      await updateUserProfile(editingUser.uid, {
        name: uName.trim(),
        email: uEmail.trim(),
        role: uRole,
        contactNumber: uContact.trim(),
        groupId: uGroupId,
        organizationName: uOrgName.trim() || matchedGroup?.organizationName || editingUser.organizationName || 'Metro Volunteer Group'
      });
      setEditingUser(null);
      showSuccessToast('User Profile Updated');
    } catch (err) {
      console.error(err);
      showErrorAlert('Update Failed', 'Failed to update user profile.');
    } finally {
      setUserSubmitting(false);
    }
  };

  const handleDeleteUser = async (uid: string, name: string, role?: string) => {
    if (role === 'HOST') {
      showErrorAlert('Action Restricted', 'Host HQ administrator accounts cannot be deleted.');
      return;
    }

    const confirmed = await confirmDeleteAlert(
      'Delete User Account?',
      `Are you sure you want to delete user "${name}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await deleteUserProfile(uid);
      showSuccessToast('User Account Deleted');
    } catch (err: any) {
      console.error(err);
      showErrorAlert('Delete Failed', err?.message || 'Could not delete user account.');
    }
  };

  const handleReassignUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserToReassign || !targetGroupId) return;
    setReassignSubmitting(true);
    try {
      const matchedGroup = groups.find(g => g.groupId === targetGroupId);
      await updateUserGroupAssignment(
        selectedUserToReassign.uid,
        targetGroupId,
        matchedGroup?.organizationName
      );
      setSelectedUserToReassign(null);
      showSuccessToast('User Reassigned to New Group');
    } catch (err) {
      console.error(err);
      showErrorAlert('Reassignment Failed', 'Failed to reassign user group.');
    } finally {
      setReassignSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <HeaderBar />

      <main className="max-w-md md:max-w-4xl mx-auto px-4 pt-4 space-y-5">
        {/* Active Alert Banner - Overview Page Only */}
        {activeTab === 'overview' && (
          <AlertBanner alert={currentAlert} userRole={userProfile.role} />
        )}

        {/* Overview Tab: ONLY Host Override Card + Total Users and Groups Cards */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Host Override Card */}
            <TriAlarmPanel
              userRole={userProfile.role}
              userId={userProfile.uid}
              userName={userProfile.name}
              isHostOverride={true}
            />

            {/* Total Users & Groups Cards */}
            <div className="grid grid-cols-2 gap-3">
              {/* Total Users Card */}
              <div 
                onClick={() => setActiveTab('members')}
                className="bg-slate-900 border border-slate-800 hover:border-blue-500/50 p-4 sm:p-5 rounded-2xl shadow-xl space-y-2 cursor-pointer transition active:scale-98"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-full bg-blue-950 border border-blue-800 text-blue-400 flex items-center justify-center shadow-inner">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 bg-blue-950 text-blue-300 rounded-full border border-blue-800">
                    Manage
                  </span>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-black text-slate-100">{users.length}</div>
                  <div className="text-xs font-bold text-slate-300 mt-0.5">Total Users</div>
                  <div className="text-[10px] text-slate-500 font-mono">Hosts, Leaders & Members</div>
                </div>
              </div>

              {/* Total Groups Card */}
              <div 
                onClick={() => setActiveTab('groups')}
                className="bg-slate-900 border border-slate-800 hover:border-purple-500/50 p-4 sm:p-5 rounded-2xl shadow-xl space-y-2 cursor-pointer transition active:scale-98"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-full bg-purple-950 border border-purple-800 text-purple-400 flex items-center justify-center shadow-inner">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 bg-purple-950 text-purple-300 rounded-full border border-purple-800">
                    Manage
                  </span>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-black text-slate-100">{groups.length}</div>
                  <div className="text-xs font-bold text-slate-300 mt-0.5">Total Groups</div>
                  <div className="text-[10px] text-slate-500 font-mono">Active Volunteer Units</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Alerts Tab: Recent and All Alerts for Host */}
        {activeTab === 'alerts' && (
          <AlertHistoryPanel 
            userRole={userProfile.role}
          />
        )}

        {/* Backup Alarm Tab */}
        {activeTab === 'alarm' && (
          <TriAlarmPanel
            userRole={userProfile.role}
            userId={userProfile.uid}
            userName={userProfile.name}
            isHostOverride={true}
          />
        )}

        {/* Volunteer Groups Tab (CRUD Operations) */}
        {activeTab === 'groups' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-400" />
                <span>Volunteer Groups Management ({groups.length})</span>
              </h3>

              <button
                onClick={() => {
                  setNewGroupId('');
                  setNewOrgName('');
                  setSelectedLeaderUid('');
                  setNewLeaderName('');
                  setSelectedMemberUids([]);
                  setMemberPickerUid('');
                  setShowCreateGroupModal(true);
                }}
                className="min-h-[38px] px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow"
              >
                <PlusCircle className="w-4 h-4" />
                <span>New Group</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {groups.length === 0 ? (
                <div className="p-4 bg-slate-950 rounded-xl text-xs text-slate-400 border border-slate-800 text-center col-span-2">
                  No groups registered yet. Click 'New Group' to create one.
                </div>
              ) : (
                groups.map((g) => {
                  const groupUsers = users.filter(u => u.groupId === g.groupId);
                  const leader = groupUsers.find(u => u.role === 'YOUTH_LEADER');

                  return (
                    <div key={g.groupId} className="p-4 bg-slate-950 border border-slate-800 hover:border-slate-700/80 rounded-2xl space-y-3 relative transition shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-extrabold text-sm text-slate-100">{g.organizationName}</div>
                          <div className="text-[11px] text-purple-400 font-mono mt-0.5">ID: {g.groupId}</div>
                        </div>
                        <span className="text-[10px] bg-slate-900 border border-slate-700/80 px-2.5 py-1 rounded-xl text-slate-300 font-bold flex-shrink-0">
                          {groupUsers.length} members
                        </span>
                      </div>

                      <div className="text-xs text-slate-400 border-t border-slate-800/80 pt-2.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-[11px] min-w-0">
                          <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">Leader: <strong className="text-slate-200">{leader?.name || g.leaderName || 'Unassigned'}</strong></span>
                        </div>

                        {/* Group Actions: View Details, Edit & Delete */}
                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            onClick={() => setViewingGroupDetails(g)}
                            className="px-2 py-1 bg-purple-950/90 hover:bg-purple-900 text-purple-200 border border-purple-800/80 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                            title="View Group Details & Roster"
                          >
                            <Eye className="w-3.5 h-3.5 text-purple-300" />
                            <span>Details</span>
                          </button>

                          <button
                            onClick={() => {
                              setEditingGroup(g);
                              setNewOrgName(g.organizationName);
                              const matchedLeader = users.find(u => u.role === 'YOUTH_LEADER' && (u.groupId === g.groupId || u.name === g.leaderName));
                              setSelectedLeaderUid(matchedLeader?.uid || '');
                              setNewLeaderName(g.leaderName || matchedLeader?.name || '');
                              const currentMembers = users.filter(u => u.role === 'MEMBER' && u.groupId === g.groupId).map(u => u.uid);
                              setSelectedMemberUids(currentMembers);
                              setMemberPickerUid('');
                            }}
                            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-700 transition"
                            title="Edit Group"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteGroup(g.groupId, g.organizationName)}
                            className="p-1.5 bg-slate-900 hover:bg-red-950 text-red-400 rounded-lg border border-slate-700 transition"
                            title="Delete Group"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* User Directory Management Tab (CRUD Operations) */}
        {activeTab === 'members' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-200">
                  User Management Directory ({users.length})
                </h3>
              </div>

              <button
                onClick={() => {
                  setUName('');
                  setUEmail('');
                  setUContact('');
                  setURole('MEMBER');
                  setShowCreateUserModal(true);
                }}
                className="min-h-[38px] px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create User</span>
              </button>
            </div>

            {/* Role Filter buttons */}
            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto w-full">
              {['ALL', 'HOST', 'YOUTH_LEADER', 'MEMBER'].map((role) => (
                <button
                  key={role}
                  onClick={() => setStatusFilter(role)}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition whitespace-nowrap min-h-[36px] ${
                    statusFilter === role ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {role === 'YOUTH_LEADER' ? 'LEADERS' : role === 'ALL' ? 'ALL ROLES' : `${role}S`}
                </button>
              ))}
            </div>

            {/* Search box */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="text"
                placeholder="Search user by name, email, or group ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* User Cards List with Edit, Delete & Assign Group */}
            <div className="space-y-2.5">
              {users.filter(u => {
                const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase()) || (u.groupId || '').toLowerCase().includes(searchTerm.toLowerCase());
                const matchesRole = statusFilter === 'ALL' || u.role === statusFilter;
                return matchesSearch && matchesRole;
              }).length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500 italic bg-slate-950/40 rounded-xl border border-slate-800">
                  No registered users match the search criteria.
                </div>
              ) : (
                users.filter(u => {
                  const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase()) || (u.groupId || '').toLowerCase().includes(searchTerm.toLowerCase());
                  const matchesRole = statusFilter === 'ALL' || u.role === statusFilter;
                  return matchesSearch && matchesRole;
                }).map((u) => {
                  let roleBadge = 'bg-slate-800 text-slate-300 border-slate-700';
                  if (u.role === 'HOST') roleBadge = 'bg-purple-950 text-purple-300 border-purple-700';
                  if (u.role === 'YOUTH_LEADER') roleBadge = 'bg-blue-950 text-blue-300 border-blue-700';
                  if (u.role === 'MEMBER') roleBadge = 'bg-emerald-950 text-emerald-300 border-emerald-700';

                  return (
                    <div
                      key={u.uid}
                      className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-slate-700 transition"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-xs text-slate-100">{u.name}</span>
                          <span className={`px-2 py-0.5 text-[9px] font-black rounded border ${roleBadge}`}>
                            {u.role}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{u.email} {u.contactNumber ? `• ${u.contactNumber}` : ''}</div>
                        <div className="text-[10px] text-purple-400 mt-0.5 font-medium">
                          Group: <strong>{u.groupId || 'GRP-001'}</strong> ({u.organizationName || 'Metro Volunteer Group'})
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center space-x-1.5 self-end sm:self-center">
                        <button
                          onClick={() => {
                            setEditingUser(u);
                            setUName(u.name);
                            setUEmail(u.email);
                            setURole(u.role);
                            setUContact(u.contactNumber || '');
                            setUGroupId(u.groupId || 'GRP-001');
                            setUOrgName(u.organizationName || '');
                          }}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl min-h-[36px] flex items-center gap-1.5 text-xs font-bold transition active:scale-95"
                          title="Edit User Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedUserToReassign(u);
                            setTargetGroupId(u.groupId || 'GRP-001');
                          }}
                          className="px-2.5 py-1.5 bg-purple-950/80 hover:bg-purple-900 text-purple-200 border border-purple-800 rounded-xl min-h-[36px] flex items-center gap-1.5 text-xs font-bold transition active:scale-95"
                          title="Assign/Swap Group"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5 text-purple-300" />
                          <span>Swap</span>
                        </button>

                        {u.role !== 'HOST' && (
                          <button
                            onClick={() => handleDeleteUser(u.uid, u.name, u.role)}
                            className="px-2.5 py-1.5 bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800 rounded-xl min-h-[36px] flex items-center gap-1.5 text-xs font-bold transition active:scale-95"
                            title="Delete User"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODAL 0: VIEW GROUP DETAILS */}
      {viewingGroupDetails && (() => {
        const groupMembers = users.filter(u => u.groupId === viewingGroupDetails.groupId && u.role === 'MEMBER');
        const assignedLeader = users.find(u => u.role === 'YOUTH_LEADER' && (u.groupId === viewingGroupDetails.groupId || u.name === viewingGroupDetails.leaderName));

        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-3.5">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-purple-400" />
                    <h3 className="text-base font-black text-white">{viewingGroupDetails.organizationName}</h3>
                  </div>
                  <div className="text-xs text-purple-400 font-mono mt-0.5">Group ID: {viewingGroupDetails.groupId}</div>
                </div>
                <button
                  onClick={() => setViewingGroupDetails(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Assigned Youth Leader Section */}
              <div className="space-y-2">
                <div className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-blue-400">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span>Assigned Youth Leader</span>
                  </span>
                  <span className="px-2 py-0.5 text-[9px] font-black rounded bg-blue-950 text-blue-300 border border-blue-800 uppercase">
                    Actual Role: YOUTH_LEADER
                  </span>
                </div>

                {assignedLeader ? (
                  <div className="p-3.5 bg-gradient-to-r from-blue-950/40 via-slate-950 to-slate-950 border border-blue-800/60 rounded-2xl flex items-center justify-between gap-3 shadow-inner">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-blue-900 text-blue-100 font-black text-xs flex items-center justify-center border border-blue-600 shrink-0">
                        {assignedLeader.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-100 truncate">{assignedLeader.name}</div>
                        <div className="text-[10px] text-slate-300 flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{assignedLeader.email}</span>
                        </div>
                        {assignedLeader.contactNumber && (
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono mt-0.5">
                            <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>{assignedLeader.contactNumber}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-slate-200">
                        {viewingGroupDetails.leaderName || 'No Leader Assigned'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        No active Youth Leader account linked to this group yet.
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const g = viewingGroupDetails;
                        setViewingGroupDetails(null);
                        setEditingGroup(g);
                        setNewOrgName(g.organizationName);
                        setSelectedLeaderUid('');
                        setNewLeaderName(g.leaderName || '');
                        const currentMembers = users.filter(u => u.role === 'MEMBER' && u.groupId === g.groupId).map(u => u.uid);
                        setSelectedMemberUids(currentMembers);
                        setMemberPickerUid('');
                      }}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shrink-0 transition"
                    >
                      Assign Leader
                    </button>
                  </div>
                )}
              </div>

              {/* Member Roster List */}
              <div className="space-y-2">
                <div className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center justify-between">
                  <span>Group Member Roster</span>
                  <span className="text-[10px] text-slate-500 font-normal">{groupMembers.length} registered</span>
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {groupMembers.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-500 italic bg-slate-950 rounded-2xl border border-slate-800">
                      No volunteer members assigned to this group yet.
                    </div>
                  ) : (
                    groupMembers.map((m) => {
                      let statusBadge = 'bg-slate-900 text-slate-400 border-slate-800';
                      if (m.emergencyStatus === 'SAFE') statusBadge = 'bg-emerald-950 text-emerald-300 border-emerald-800';
                      if (m.emergencyStatus === 'NEEDS_ASSISTANCE') statusBadge = 'bg-amber-950 text-amber-300 border-amber-800';
                      if (m.emergencyStatus === 'DANGER') statusBadge = 'bg-red-950 text-red-300 border-red-800';

                      return (
                        <div
                          key={m.uid}
                          className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-200 font-bold text-xs flex items-center justify-center border border-slate-700 shrink-0">
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-100 truncate">{m.name}</div>
                              <div className="text-[10px] text-slate-400 truncate">{m.email} {m.contactNumber ? `• ${m.contactNumber}` : ''}</div>
                            </div>
                          </div>

                          <span className={`px-2 py-0.5 text-[9px] font-black rounded-lg border shrink-0 ${statusBadge}`}>
                            {m.emergencyStatus || 'UNACCOUNTED'}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                <button
                  onClick={() => {
                    const g = viewingGroupDetails;
                    setViewingGroupDetails(null);
                    setEditingGroup(g);
                    setNewOrgName(g.organizationName);
                    const leaderUser = users.find(u => u.role === 'YOUTH_LEADER' && (u.groupId === g.groupId || u.name === g.leaderName));
                    setSelectedLeaderUid(leaderUser?.uid || '');
                    setNewLeaderName(g.leaderName || leaderUser?.name || '');
                    const currentMembers = users.filter(u => u.role === 'MEMBER' && u.groupId === g.groupId).map(u => u.uid);
                    setSelectedMemberUids(currentMembers);
                    setMemberPickerUid('');
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Group</span>
                </button>

                <button
                  onClick={() => setViewingGroupDetails(null)}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL 1: CREATE GROUP */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-400" />
                <span>Create Volunteer Group</span>
              </h3>
              <button
                onClick={() => setShowCreateGroupModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Group ID (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. GRP-002"
                  value={newGroupId}
                  onChange={(e) => setNewGroupId(e.target.value)}
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Organization / Unit Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Quezon City Volunteer Group Unit 2"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Assign Youth Leader</span>
                  <span className="text-[10px] text-blue-400 font-mono font-bold">Role: YOUTH_LEADER</span>
                </label>
                <select
                  value={selectedLeaderUid}
                  onChange={(e) => {
                    const uid = e.target.value;
                    setSelectedLeaderUid(uid);
                    const chosen = youthLeaders.find(u => u.uid === uid);
                    setNewLeaderName(chosen ? chosen.name : '');
                  }}
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">-- No Youth Leader Selected (Unassigned) --</option>
                  {availableLeadersForCreate.map((leader) => (
                    <option key={leader.uid} value={leader.uid}>
                      {leader.name} ({leader.email}) — Youth Volunteer Leader
                    </option>
                  ))}
                </select>

                {selectedLeaderUid && (() => {
                  const chosen = youthLeaders.find(u => u.uid === selectedLeaderUid);
                  if (!chosen) return null;
                  return (
                    <div className="mt-2 p-2.5 bg-blue-950/60 border border-blue-800/80 rounded-xl text-xs space-y-0.5">
                      <div className="flex items-center justify-between font-bold text-blue-200">
                        <span>Assigned: {chosen.name}</span>
                        <span className="px-2 py-0.5 bg-blue-900 text-blue-200 rounded text-[9px] font-black uppercase tracking-wider">
                          {chosen.role}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-300 truncate">{chosen.email} {chosen.contactNumber ? `• ${chosen.contactNumber}` : ''}</div>
                    </div>
                  );
                })()}

                {availableLeadersForCreate.length === 0 && !selectedLeaderUid && (
                  <div className="mt-1.5 p-2 bg-amber-950/40 border border-amber-800/60 rounded-xl text-[11px] text-amber-300 space-y-1">
                    <p>⚠️ All registered Youth Leaders are already assigned to active groups, or none exist.</p>
                  </div>
                )}
              </div>

              {/* Assign Members Section */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Assign Group Members ({selectedMemberUids.length})</span>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">Role: MEMBER</span>
                </label>
                <select
                  value={memberPickerUid}
                  onChange={(e) => {
                    const uid = e.target.value;
                    if (uid && !selectedMemberUids.includes(uid)) {
                      setSelectedMemberUids(prev => [...prev, uid]);
                    }
                    setMemberPickerUid('');
                  }}
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">+ Select a member to add to this group...</option>
                  {allMembers.map((m) => {
                    const isAlreadySelected = selectedMemberUids.includes(m.uid);
                    const currentGroupInfo = m.groupId ? `Currently in ${m.groupId}` : 'Unassigned';
                    return (
                      <option key={m.uid} value={m.uid} disabled={isAlreadySelected}>
                        {m.name} ({m.email}) — {isAlreadySelected ? '✓ Selected' : currentGroupInfo}
                      </option>
                    );
                  })}
                </select>

                {/* Selected Members Roster */}
                <div className="mt-2 space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                  {selectedMemberUids.length === 0 ? (
                    <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-[11px] text-slate-500 italic text-center">
                      No members assigned yet. Use the dropdown above to add members.
                    </div>
                  ) : (
                    selectedMemberUids.map((mUid) => {
                      const m = allMembers.find(u => u.uid === mUid);
                      if (!m) return null;
                      return (
                        <div
                          key={mUid}
                          className="p-2 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-100 truncate">{m.name}</div>
                              <div className="text-[10px] text-slate-400 truncate">{m.email}</div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedMemberUids(prev => prev.filter(id => id !== mUid))}
                            className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-900 rounded-lg transition shrink-0"
                            title="Remove from group"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  className="min-h-[44px] px-4 py-2 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={groupSubmitting}
                  className="min-h-[44px] px-5 py-2 bg-purple-600 text-white font-black text-xs uppercase tracking-wider rounded-xl hover:bg-purple-500 active:scale-95 transition"
                >
                  {groupSubmitting ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT GROUP */}
      {editingGroup && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-purple-400" />
                <span>Edit Group ({editingGroup.groupId})</span>
              </h3>
              <button
                onClick={() => setEditingGroup(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateGroup} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Organization / Unit Name *</label>
                <input
                  type="text"
                  required
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Assigned Youth Leader</span>
                  <span className="text-[10px] text-blue-400 font-mono font-bold">Role: YOUTH_LEADER</span>
                </label>
                <select
                  value={selectedLeaderUid}
                  onChange={(e) => {
                    const uid = e.target.value;
                    setSelectedLeaderUid(uid);
                    const chosen = youthLeaders.find(u => u.uid === uid);
                    setNewLeaderName(chosen ? chosen.name : '');
                  }}
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">-- No Youth Leader Selected (Unassigned) --</option>
                  {getAvailableLeadersForEdit(editingGroup).map((leader) => (
                    <option key={leader.uid} value={leader.uid}>
                      {leader.name} ({leader.email}) — Youth Volunteer Leader
                    </option>
                  ))}
                </select>

                {selectedLeaderUid && (() => {
                  const chosen = youthLeaders.find(u => u.uid === selectedLeaderUid);
                  if (!chosen) return null;
                  return (
                    <div className="mt-2 p-2.5 bg-blue-950/60 border border-blue-800/80 rounded-xl text-xs space-y-0.5">
                      <div className="flex items-center justify-between font-bold text-blue-200">
                        <span>Assigned: {chosen.name}</span>
                        <span className="px-2 py-0.5 bg-blue-900 text-blue-200 rounded text-[9px] font-black uppercase tracking-wider">
                          {chosen.role}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-300 truncate">{chosen.email} {chosen.contactNumber ? `• ${chosen.contactNumber}` : ''}</div>
                    </div>
                  );
                })()}

                {getAvailableLeadersForEdit(editingGroup).length === 0 && !selectedLeaderUid && (
                  <div className="mt-1.5 p-2 bg-amber-950/40 border border-amber-800/60 rounded-xl text-[11px] text-amber-300 space-y-1">
                    <p>⚠️ All registered Youth Leaders are assigned to other groups.</p>
                  </div>
                )}
              </div>

              {/* Assign Members Section */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Assign Group Members ({selectedMemberUids.length})</span>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">Role: MEMBER</span>
                </label>
                <select
                  value={memberPickerUid}
                  onChange={(e) => {
                    const uid = e.target.value;
                    if (uid && !selectedMemberUids.includes(uid)) {
                      setSelectedMemberUids(prev => [...prev, uid]);
                    }
                    setMemberPickerUid('');
                  }}
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">+ Select a member to add to this group...</option>
                  {allMembers.map((m) => {
                    const isAlreadySelected = selectedMemberUids.includes(m.uid);
                    const currentGroupInfo = m.groupId ? `Currently in ${m.groupId}` : 'Unassigned';
                    return (
                      <option key={m.uid} value={m.uid} disabled={isAlreadySelected}>
                        {m.name} ({m.email}) — {isAlreadySelected ? '✓ Selected' : currentGroupInfo}
                      </option>
                    );
                  })}
                </select>

                {/* Selected Members Roster */}
                <div className="mt-2 space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                  {selectedMemberUids.length === 0 ? (
                    <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-[11px] text-slate-500 italic text-center">
                      No members assigned yet. Use the dropdown above to add members.
                    </div>
                  ) : (
                    selectedMemberUids.map((mUid) => {
                      const m = allMembers.find(u => u.uid === mUid);
                      if (!m) return null;
                      return (
                        <div
                          key={mUid}
                          className="p-2 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-100 truncate">{m.name}</div>
                              <div className="text-[10px] text-slate-400 truncate">{m.email}</div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedMemberUids(prev => prev.filter(id => id !== mUid))}
                            className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-900 rounded-lg transition shrink-0"
                            title="Remove from group"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  className="min-h-[44px] px-4 py-2 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={groupSubmitting}
                  className="min-h-[44px] px-5 py-2 bg-purple-600 text-white font-black text-xs uppercase tracking-wider rounded-xl hover:bg-purple-500 active:scale-95 transition"
                >
                  {groupSubmitting ? 'Saving...' : 'Update Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CREATE USER */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-400" />
                <span>Create System User</span>
              </h3>
              <button
                onClick={() => setShowCreateUserModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Juan Dela Cruz"
                  value={uName}
                  onChange={(e) => setUName(e.target.value)}
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. juan@readyalert.org"
                  value={uEmail}
                  onChange={(e) => setUEmail(e.target.value)}
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Assign System Role *</label>
                <select
                  value={uRole}
                  onChange={(e) => setURole(e.target.value as UserRole)}
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="MEMBER">Volunteer Member</option>
                  <option value="YOUTH_LEADER">Youth Volunteer Leader</option>
                  <option value="HOST">Host Operations Staff</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Contact Number</label>
                <input
                  type="text"
                  placeholder="+63 917 123 4567"
                  value={uContact}
                  onChange={(e) => setUContact(e.target.value)}
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="min-h-[44px] px-4 py-2 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={userSubmitting}
                  className="min-h-[44px] px-5 py-2 bg-blue-600 text-white font-black text-xs uppercase tracking-wider rounded-xl hover:bg-blue-500 active:scale-95 transition"
                >
                  {userSubmitting ? 'Saving...' : 'Register User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: EDIT USER */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-400" />
                <span>Edit User Profile</span>
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={uName}
                  onChange={(e) => setUName(e.target.value)}
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={uEmail}
                  onChange={(e) => setUEmail(e.target.value)}
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Role *</label>
                <select
                  value={uRole}
                  onChange={(e) => setURole(e.target.value as UserRole)}
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="MEMBER">Volunteer Member</option>
                  <option value="YOUTH_LEADER">Youth Volunteer Leader</option>
                  <option value="HOST">Host Operations Staff</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Contact Number</label>
                <input
                  type="text"
                  value={uContact}
                  onChange={(e) => setUContact(e.target.value)}
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="min-h-[44px] px-4 py-2 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={userSubmitting}
                  className="min-h-[44px] px-5 py-2 bg-blue-600 text-white font-black text-xs uppercase tracking-wider rounded-xl hover:bg-blue-500 active:scale-95 transition"
                >
                  {userSubmitting ? 'Saving...' : 'Update User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: REASSIGN USER GROUP */}
      {selectedUserToReassign && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-purple-400" />
                <span>Reassign User Group</span>
              </h3>
              <button
                onClick={() => setSelectedUserToReassign(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 text-xs">
              <div className="font-bold text-white">{selectedUserToReassign.name}</div>
              <div className="text-slate-400">{selectedUserToReassign.email} • {selectedUserToReassign.role}</div>
              <div className="text-purple-400">Current Group: <strong>{selectedUserToReassign.groupId || 'Unassigned'}</strong></div>
            </div>

            <form onSubmit={handleReassignUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Select New Target Group</label>
                <select
                  value={targetGroupId}
                  onChange={(e) => setTargetGroupId(e.target.value)}
                  className="w-full min-h-[48px] bg-slate-950 border border-slate-700 rounded-xl px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {groups.map((g) => (
                    <option key={g.groupId} value={g.groupId}>
                      {g.groupId} — {g.organizationName}
                    </option>
                  ))}
                  {groups.length === 0 && <option value="GRP-001">GRP-001 — Metro Youth Volunteers Unit 1</option>}
                </select>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserToReassign(null)}
                  className="min-h-[44px] px-4 py-2 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reassignSubmitting}
                  className="min-h-[44px] px-5 py-2 bg-purple-600 text-white font-black text-xs uppercase tracking-wider rounded-xl hover:bg-purple-500 active:scale-95 transition flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{reassignSubmitting ? 'Updating...' : 'Save Reassignment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BottomNav
        role={userProfile.role}
        activeTab={activeTab}
        onSelectTab={(t) => setActiveTab(t)}
        hasActiveAlert={!!currentAlert}
      />
    </div>
  );
};
