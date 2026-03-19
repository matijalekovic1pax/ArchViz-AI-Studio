import React, { useState, useEffect } from 'react';
import { Users, Zap, CreditCard, Mail, Trash2, Loader2, Crown, Shield, User, ExternalLink, Plus } from 'lucide-react';
import { useAuth } from '../auth/AuthGate';
import { inviteTeamMember, removeTeamMember, updateTeamMemberRole, createPortalSession } from '../../services/apiGateway';
import { PLAN_LABELS } from '../../lib/stripePrices';
import { cn } from '../../lib/utils';

type TabId = 'members' | 'credits' | 'subscription';

interface Member {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  avatar_url?: string;
}

const ROLE_ICONS = {
  owner: Crown,
  admin: Shield,
  member: User,
};

const ROLE_LABEL = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
};

export function TeamDashboard() {
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState<TabId>('members');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const org = user?.org;
  if (!org || (org.role !== 'owner' && org.role !== 'admin')) return null;

  const planLabel = PLAN_LABELS[org.plan] ?? org.plan;
  const canManage = org.role === 'owner' || org.role === 'admin';

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(false);
    try {
      await inviteTeamMember(org.id, inviteEmail.trim(), inviteRole);
      setInviteSuccess(true);
      setInviteEmail('');
    } catch (err: any) {
      setInviteError(err.message || 'Failed to send invitation.');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm('Remove this member from the team?')) return;
    setRemoving(memberId);
    try {
      await removeTeamMember(org.id, memberId);
      await refreshUser();
    } catch {
      // TODO: show error
    } finally {
      setRemoving(null);
    }
  };

  const openPortal = async () => {
    setLoadingPortal(true);
    try {
      const { url } = await createPortalSession();
      window.location.href = url;
    } catch {
      setLoadingPortal(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">{org.name}</h1>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-accent/10 text-accent">{planLabel}</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-sunken rounded-lg p-1 border border-border">
        {(['members', 'credits', 'subscription'] as TabId[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-1.5 text-xs font-semibold rounded-md capitalize transition-colors',
              tab === t
                ? 'bg-surface-elevated text-foreground shadow-sm'
                : 'text-foreground-muted hover:text-foreground'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Members tab */}
      {tab === 'members' && (
        <div className="space-y-4">
          {/* Invite form */}
          {canManage && (
            <form onSubmit={handleInvite} className="bg-surface-elevated border border-border rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">Invite team member</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  required
                  className="flex-1 h-9 bg-surface-sunken border border-border rounded-md text-sm px-3 text-foreground placeholder-foreground-muted/60 focus:outline-none focus:border-accent"
                />
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as 'admin' | 'member')}
                  className="h-9 bg-surface-sunken border border-border rounded-md text-sm px-2 text-foreground focus:outline-none focus:border-accent"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="submit"
                  disabled={inviting}
                  className="h-9 px-4 bg-accent text-accent-foreground text-sm font-semibold rounded-md hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {inviting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  Invite
                </button>
              </div>
              {inviteError && <p className="text-xs text-red-500">{inviteError}</p>}
              {inviteSuccess && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <Mail size={12} /> Invitation sent!
                </p>
              )}
            </form>
          )}

          {/* Member list placeholder — in production this would come from a /team/members API call */}
          <div className="bg-surface-elevated border border-border rounded-xl divide-y divide-border-subtle overflow-hidden">
            <div className="p-3 flex items-center gap-3">
              {user?.avatar_url && (
                <img src={user.avatar_url} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
                <p className="text-xs text-foreground-muted truncate">{user?.email}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-foreground-muted">
                <Crown size={12} className="text-amber-500" />
                <span>You (Owner)</span>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-foreground-muted text-center">
            Seat limit: {org.seat_limit} · Contact support to increase seats.
          </p>
        </div>
      )}

      {/* Credits tab */}
      {tab === 'credits' && (
        <div className="bg-surface-elevated border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Team credit pool</p>
            <div className="flex items-center gap-1.5">
              <Zap size={14} className="text-accent" />
              <span className="text-lg font-bold text-foreground">{org.credits.toLocaleString()}</span>
              <span className="text-xs text-foreground-muted">credits</span>
            </div>
          </div>
          <p className="text-xs text-foreground-muted">
            Credits are shared across all team members. Generations by any member deduct from this pool.
          </p>
          <button
            onClick={() => setTab('subscription')}
            className="text-xs text-accent hover:underline"
          >
            Manage subscription to add more credits →
          </button>
        </div>
      )}

      {/* Subscription tab */}
      {tab === 'subscription' && (
        <div className="bg-surface-elevated border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-foreground-muted uppercase tracking-widest font-semibold">Current Plan</p>
              <p className="text-lg font-bold text-foreground mt-0.5">{planLabel}</p>
            </div>
            <button
              onClick={openPortal}
              disabled={loadingPortal}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-border rounded-lg hover:bg-surface-sunken transition-colors disabled:opacity-50"
            >
              {loadingPortal ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
              Manage subscription
            </button>
          </div>
          <p className="text-xs text-foreground-muted">
            Manage invoices, payment methods, and cancel your subscription via the billing portal.
          </p>
        </div>
      )}
    </div>
  );
}
