import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Wallet, Plus, Trash2, Tag } from 'lucide-react';
import { Member, PersonalExpense } from '../types';

const CATEGORIES = ['Food', 'Travel', 'Rent', 'Shopping', 'Utilities', 'Other'];
const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#eab308'];

export default function PersonalExpenses() {
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [expenses, setExpenses] = useState<PersonalExpense[]>([]);
  const [showForm, setShowForm] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const res = await fetch('/api/members');
        const contentType = res.headers.get("content-type");
        let data;
        if (contentType && contentType.includes("application/json")) {
          data = await res.json();
        } else {
          throw new Error(await res.text() || "Failed to load members");
        }

        if (res.ok) {
          setMembers(Array.isArray(data) ? data : []);
          if (Array.isArray(data) && data.length > 0) {
            const pranish = data.find((m: Member) => m.name.toLowerCase() === 'pranish');
            setSelectedMemberId(pranish ? pranish.id : data[0].id);
          }
        } else {
          setError(data.error || 'Failed to load members');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error. Please check your connection.');
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedMemberId) {
      const fetchPersonalExpenses = async () => {
        try {
          const res = await fetch(`/api/personal-expenses/${selectedMemberId}`);
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const data = await res.json();
            if (res.ok) {
              setExpenses(Array.isArray(data) ? data : []);
            }
          }
        } catch (err) {
          console.error('Failed to fetch personal expenses:', err);
        }
      };
      fetchPersonalExpenses();
    }
  }, [selectedMemberId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId) return;
    setError('');

    try {
      const res = await fetch('/api/personal-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: selectedMemberId,
          title,
          amount,
          category,
          date: new Date(date).toISOString()
        })
      });

      const data = await res.json();

      if (res.ok) {
        setShowForm(false);
        setTitle('');
        setAmount('');
        const updatedRes = await fetch(`/api/personal-expenses/${selectedMemberId}`);
        const updatedData = await updatedRes.json();
        setExpenses(Array.isArray(updatedData) ? updatedData : []);
      } else {
        setError(data.error || 'Failed to save expense');
      }
    } catch (err) {
      setError('Failed to save expense. Please try again.');
    }
  };

  const chartData = CATEGORIES.map(cat => ({
    name: cat,
    value: expenses.filter(e => e.category === cat).reduce((acc, curr) => acc + curr.amount, 0)
  })).filter(d => d.value > 0);

  const totalSpent = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <header>
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-white">Personal Finance</h2>
          <p className="text-zinc-500 dark:text-zinc-400">Track your private spending and habits.</p>
        </header>
        <div className="flex items-center gap-3">
          <select
            value={selectedMemberId || ''}
            onChange={e => setSelectedMemberId(parseInt(e.target.value))}
            className="px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          >
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
          >
            <Plus className="w-5 h-5" />
            Add Expense
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl animate-in fade-in slide-in-from-top-4">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Title</label>
              <input
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="e.g. Coffee"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Amount (₹)</label>
              <input
                required
                type="number"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              >
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Date</label>
              <input
                required
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="md:col-span-3 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-3 rounded-xl text-zinc-600 dark:text-zinc-400 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-all shadow-lg shadow-indigo-500/20"
              >
                Save Expense
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-xl font-semibold mb-6 text-zinc-900 dark:text-white">Spending Analytics</h3>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '12px', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-xl font-semibold mb-4 text-zinc-900 dark:text-white">Recent Transactions</h3>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {expenses.length === 0 ? (
                <p className="py-8 text-center text-zinc-500 italic">No personal expenses recorded.</p>
              ) : (
                expenses.map(exp => (
                  <div key={exp.id} className="py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                        <Tag className="w-4 h-4 text-zinc-500" />
                      </div>
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-white">{exp.title}</p>
                        <p className="text-xs text-zinc-500">{exp.category} • {new Date(exp.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <span className="font-bold text-zinc-900 dark:text-white">₹{exp.amount.toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-indigo-600 p-8 rounded-2xl text-white shadow-xl shadow-indigo-500/20">
            <Wallet className="w-8 h-8 mb-4 opacity-80" />
            <p className="text-indigo-100 text-sm font-medium uppercase tracking-wider">Total Monthly Spend</p>
            <h3 className="text-4xl font-bold mt-1">₹{totalSpent.toLocaleString()}</h3>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-xl font-semibold mb-6 text-zinc-900 dark:text-white">Category Breakdown</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {chartData.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-zinc-600 dark:text-zinc-400">{d.name}</span>
                  </div>
                  <span className="font-medium text-zinc-900 dark:text-white">₹{d.value.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
