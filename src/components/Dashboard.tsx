import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, ArrowDownLeft, Wallet, TrendingUp, Info } from 'lucide-react';
import { BalancesResponse, Member, SharedExpense, cn } from '../types';

export default function Dashboard() {
  const [balances, setBalances] = useState<BalancesResponse | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<SharedExpense[]>([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [balRes, memRes, expRes] = await Promise.all([
          fetch('/api/balances'),
          fetch('/api/members'),
          fetch('/api/shared-expenses')
        ]);
        
        const parseResponse = async (res: Response) => {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            return await res.json();
          }
          return { error: await res.text() || "Unknown server error" };
        };

        if (!balRes.ok || !memRes.ok || !expRes.ok) {
          const balErr = !balRes.ok ? await parseResponse(balRes) : null;
          const memErr = !memRes.ok ? await parseResponse(memRes) : null;
          throw new Error(balErr?.error || memErr?.error || 'Failed to connect to the database. Please check your DATABASE_URL.');
        }

        const balData = await balRes.json();
        const memData = await memRes.json();
        const expData = await expRes.json();

        setBalances(balData);
        setMembers(memData);
        setRecentExpenses(expData.slice(0, 5));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-500 animate-pulse">Connecting to database...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
          <Info className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-red-900 dark:text-red-400 mb-2">Connection Error</h3>
        <p className="text-red-700 dark:text-red-300 mb-6">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-all"
        >
          Try Again
        </button>
      </div>
    </div>
  );

  const totalShared = recentExpenses.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">
      <header>
        <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">Dashboard</h2>
        <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400">Welcome back! Here's what's happening in your shared space.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          title="Total Shared (Recent)"
          value={`₹${totalShared.toLocaleString()}`}
          icon={TrendingUp}
          color="indigo"
        />
        <StatCard
          title="Members"
          value={members.length.toString()}
          icon={UsersIcon}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-xl font-semibold mb-4 text-zinc-900 dark:text-white">Simplified Settlements</h3>
            <div className="space-y-4">
              {balances?.simplified.length === 0 ? (
                <p className="text-zinc-500 italic">All settled up! No pending debts.</p>
              ) : (
                balances?.simplified.map((s, idx) => {
                  const from = members.find(m => m.id === s.from)?.name;
                  const to = members.find(m => m.id === s.to)?.name;
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      key={idx}
                      className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-zinc-900 dark:text-white">{from}</span>
                        <ArrowUpRight className="w-4 h-4 text-red-500" />
                        <span className="font-medium text-zinc-900 dark:text-white">{to}</span>
                      </div>
                      <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                        ₹{s.amount.toFixed(2)}
                      </span>
                    </motion.div>
                  );
                })
              )}
            </div>
          </section>

          <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-xl font-semibold mb-4 text-zinc-900 dark:text-white">Recent Transactions</h3>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {recentExpenses.map((exp) => (
                <div key={exp.id} className="py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-white">{exp.title}</p>
                    <p className="text-sm text-zinc-500">Paid by {exp.paidBy.name} • {new Date(exp.date).toLocaleDateString()}</p>
                  </div>
                  <span className="font-bold text-zinc-900 dark:text-white">₹{exp.amount}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-xl font-semibold mb-4 text-zinc-900 dark:text-white">Net Balances</h3>
            <div className="space-y-3">
              {members.map(m => {
                const bal = balances?.netBalances[m.id] || 0;
                return (
                  <div key={m.id} className="flex items-center justify-between">
                    <span className="text-zinc-600 dark:text-zinc-400">{m.name}</span>
                    <span className={cn(
                      "font-medium",
                      bal > 0 ? "text-emerald-600" : bal < 0 ? "text-red-600" : "text-zinc-400"
                    )}>
                      {bal > 0 ? '+' : ''}{bal.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  const colors: any = {
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
  };

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
      <div className={cn("p-3 rounded-xl", colors[color])}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{title}</p>
        <p className="text-2xl font-bold text-zinc-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function UsersIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
