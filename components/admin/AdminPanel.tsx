import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Building2, DollarSign, BarChart2, Search,
  ChevronLeft, ChevronRight, Loader2, AlertTriangle, X,
  Ban, CheckCircle, Zap
} from 'lucide-react';
import { useAuth } from '../auth/AuthGate';
import {
  adminGetUsers, adminGetOrgs, adminUpdateUser, adminAdjustCredits,
  adminGetRevenue, adminGetAnalytics
} from '../../services/apiGateway';
import { PLAN_LABELS } from '../../lib/stripePrices';
import { cn } from '../../lib/utils';

type AdminTab = 'users' | 'orgs' | 'revenue' | 'analytics';

export function AdminPanel() {
  const { isSuperAdmin } = useAuth();
  const [tab, setTab] = useState<AdminTab>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [revenue, setRevenue] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [adjustModal, setAdjustModal] = useState<{ type: 'user' | 'org'; id: string; name: string } | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);

  if (!isSuperAdmin) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-foreground-muted text-sm">Access denied.</p>
      </div>
    );
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'users') {
        const res = await adminGetUsers({ page, search });
        setUsers(res.users ?? []);
        setTotal(res.total ?? 0);
      } else if (tab === 'orgs') {
        const res = await adminGetOrgs({ page, search });
        setOrgs(res.orgs ?? []);
        setTotal(res.total ?? 0);
      } else if (tab === 'revenue') {
        const res = await adminGetRevenue();
        setRevenue(res);
      } else if (tab === 'analytics') {
        const res = await adminGetAnalytics();
        setAnalytics(res);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [tab, page, search]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSuspendToggle = async (userId: string, suspended: boolean) => {
    try {
      await adminUpdateUser(userId, { suspended: !suspended });
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleAdjustCredits = async () => {
    if (!adjustModal) return;
    const amount = parseInt(adjustAmount);
    if (isNaN(amount)) return;
    setAdjustLoading(true);
    try {
      await adminAdjustCredits(adjustModal.type, adjustModal.id, amount, adjustReason);
      setAdjustModal(null);
      setAdjustAmount('');
      setAdjustReason('');
      loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAdjustLoading(false);
    }
  };

  const PAGE_SIZE = 20;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-700">Super Admin</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-surface-sunken rounded-lg p-1 border border-border mb-6">
          {([
            { id: 'users', label: 'Users', icon: Users },
            { id: 'orgs', label: 'Organizations', icon: Building2 },
            { id: 'revenue', label: 'Revenue', icon: DollarSign },
            { id: 'analytics', label: 'Analytics', icon: BarChart2 },
          ] as { id: AdminTab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setTab(id); setPage(1); setSearch(''); }}
              className={cn(
                'flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5',
                tab === id
                  ? 'bg-surface-elevated text-foreground shadow-sm'
                  : 'text-foreground-muted hover:text-foreground'
              )}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            <AlertTriangle size={13} />
            {error}
            <button onClick={() => setError(null)} className="ml-auto"><X size={12} /></button>
          </div>
        )}

        {/* Users Tab */}
        {tab === 'users' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="w-full h-9 pl-8 pr-3 bg-surface-sunken border border-border rounded-md text-sm text-foreground placeholder-foreground-muted/60 focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 size={20} className="animate-spin text-foreground-muted" />
              </div>
            ) : (
              <div className="bg-surface-elevated border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-subtle bg-surface-sunken">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-foreground-muted">User</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-foreground-muted">Plan</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-foreground-muted">Credits</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-foreground-muted">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {users.map((u: any) => (
                      <tr key={u.id} className="hover:bg-surface-sunken transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground text-xs">{u.name || u.email}</p>
                          <p className="text-[11px] text-foreground-muted">{u.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium text-foreground-secondary">
                            {PLAN_LABELS[u.plan as keyof typeof PLAN_LABELS] ?? u.plan}
                          </span>
                          {u.suspended_at && (
                            <span className="ml-1 text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                              SUSPENDED
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-mono text-foreground">
                          {u.credits?.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setAdjustModal({ type: 'user', id: u.id, name: u.name || u.email })}
                              className="p-1.5 rounded-md text-foreground-muted hover:text-accent hover:bg-accent/10 transition-colors"
                              title="Adjust credits"
                            >
                              <Zap size={13} />
                            </button>
                            <button
                              onClick={() => handleSuspendToggle(u.id, !!u.suspended_at)}
                              className={cn(
                                'p-1.5 rounded-md transition-colors',
                                u.suspended_at
                                  ? 'text-green-600 hover:bg-green-50'
                                  : 'text-foreground-muted hover:text-red-600 hover:bg-red-50'
                              )}
                              title={u.suspended_at ? 'Unsuspend' : 'Suspend'}
                            >
                              {u.suspended_at ? <CheckCircle size={13} /> : <Ban size={13} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center text-xs text-foreground-muted py-8">
                          No users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 text-xs text-foreground-muted">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="p-1 rounded disabled:opacity-30"
                >
                  <ChevronLeft size={14} />
                </button>
                <span>Page {page} of {totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="p-1 rounded disabled:opacity-30"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Orgs Tab */}
        {tab === 'orgs' && (
          <div className="space-y-4">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
              <input
                type="text"
                placeholder="Search organizations..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full h-9 pl-8 pr-3 bg-surface-sunken border border-border rounded-md text-sm text-foreground placeholder-foreground-muted/60 focus:outline-none focus:border-accent"
              />
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 size={20} className="animate-spin text-foreground-muted" />
              </div>
            ) : (
              <div className="bg-surface-elevated border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-subtle bg-surface-sunken">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-foreground-muted">Organization</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-foreground-muted">Plan</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-foreground-muted">Credits</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-foreground-muted">Seats</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-foreground-muted">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {orgs.map((o: any) => (
                      <tr key={o.id} className="hover:bg-surface-sunken transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground text-xs">{o.name}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-foreground-secondary">
                          {PLAN_LABELS[o.plan as keyof typeof PLAN_LABELS] ?? o.plan}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-mono text-foreground">
                          {o.credits?.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-foreground-muted">
                          {o.seat_limit}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setAdjustModal({ type: 'org', id: o.id, name: o.name })}
                            className="p-1.5 rounded-md text-foreground-muted hover:text-accent hover:bg-accent/10 transition-colors"
                            title="Adjust credits"
                          >
                            <Zap size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {orgs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center text-xs text-foreground-muted py-8">
                          No organizations found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Revenue Tab */}
        {tab === 'revenue' && !loading && revenue && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'MRR', value: `$${(revenue.mrr_cents / 100).toFixed(0)}` },
              { label: 'ARR', value: `$${(revenue.arr_cents / 100).toFixed(0)}` },
              { label: 'Active Subs', value: revenue.active_subscriptions ?? 0 },
              { label: 'Credit Sales (30d)', value: `$${((revenue.credit_sales_30d_cents ?? 0) / 100).toFixed(0)}` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-surface-elevated border border-border rounded-xl p-5">
                <p className="text-xs text-foreground-muted uppercase tracking-widest font-semibold">{label}</p>
                <p className="text-2xl font-extrabold text-foreground mt-1">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Analytics Tab */}
        {tab === 'analytics' && !loading && analytics && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total Users', value: analytics.total_users ?? 0 },
              { label: 'Subscribed', value: analytics.subscribed_users ?? 0 },
              { label: 'Gens Today', value: analytics.generations_today ?? 0 },
              { label: 'Gens This Week', value: analytics.generations_week ?? 0 },
              { label: 'Avg Credits Used/Day', value: analytics.avg_credits_per_day ?? 0 },
              { label: 'Video Charges (30d)', value: analytics.video_charges_30d ?? 0 },
            ].map(({ label, value }) => (
              <div key={label} className="bg-surface-elevated border border-border rounded-xl p-5">
                <p className="text-xs text-foreground-muted uppercase tracking-widest font-semibold">{label}</p>
                <p className="text-2xl font-extrabold text-foreground mt-1">{(value as number).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}

        {loading && (tab === 'revenue' || tab === 'analytics') && (
          <div className="flex justify-center py-12">
            <Loader2 size={20} className="animate-spin text-foreground-muted" />
          </div>
        )}
      </div>

      {/* Adjust Credits Modal */}
      {adjustModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-surface-elevated rounded-2xl shadow-2xl border border-border p-6 space-y-4">
            <h3 className="text-base font-bold text-foreground">Adjust Credits</h3>
            <p className="text-xs text-foreground-muted">{adjustModal.name}</p>
            <input
              type="number"
              placeholder="Amount (negative to deduct)"
              value={adjustAmount}
              onChange={e => setAdjustAmount(e.target.value)}
              className="w-full h-9 bg-surface-sunken border border-border rounded-md text-sm px-3 text-foreground focus:outline-none focus:border-accent"
            />
            <input
              type="text"
              placeholder="Reason (required)"
              value={adjustReason}
              onChange={e => setAdjustReason(e.target.value)}
              className="w-full h-9 bg-surface-sunken border border-border rounded-md text-sm px-3 text-foreground focus:outline-none focus:border-accent"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setAdjustModal(null)}
                className="flex-1 py-2 text-xs font-semibold border border-border rounded-lg hover:bg-surface-sunken transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdjustCredits}
                disabled={adjustLoading || !adjustAmount || !adjustReason}
                className="flex-1 py-2 text-xs font-semibold bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {adjustLoading && <Loader2 size={12} className="animate-spin" />}
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
