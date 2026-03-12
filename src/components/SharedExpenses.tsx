import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Calendar, Info } from 'lucide-react';
import { Member, SharedExpense } from '../types';

export default function SharedExpenses() {
  const [expenses, setExpenses] = useState<SharedExpense[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form State
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidById, setPaidById] = useState('');
  const [splitType, setSplitType] = useState<'EQUAL' | 'CUSTOM' | 'PERCENTAGE'>('EQUAL');
  const [selectedParticipants, setSelectedParticipants] = useState<number[]>([]);
  const [customSplits, setCustomSplits] = useState<Record<number, string>>({});
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [expRes, memRes] = await Promise.all([
        fetch('/api/shared-expenses'),
        fetch('/api/members')
      ]);
      
      const parse = async (res: Response) => {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) return await res.json();
        return { error: await res.text() || "Server error" };
      };

      const expData = await parse(expRes);
      const memData = await parse(memRes);

      if (expRes.ok && memRes.ok) {
        setExpenses(Array.isArray(expData) ? expData : []);
        setMembers(Array.isArray(memData) ? memData : []);
        if (Array.isArray(memData)) {
          setSelectedParticipants(memData.map((m: Member) => m.id));
        }
      } else {
        setError(expData.error || memData.error || 'Failed to fetch data');
      }
    } catch (err) {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const totalAmount = parseFloat(amount);
      if (isNaN(totalAmount) || totalAmount <= 0) {
        throw new Error("Please enter a valid amount greater than 0");
      }

      let splits = [];

      if (splitType === 'EQUAL') {
        if (selectedParticipants.length === 0) {
          throw new Error("Please select at least one participant");
        }
        const splitAmount = totalAmount / selectedParticipants.length;
        splits = selectedParticipants.map(id => ({
          memberId: id,
          amountOwed: splitAmount
        }));
      } else if (splitType === 'CUSTOM') {
        const customTotal = Object.values(customSplits).reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
        if (Math.abs(customTotal - totalAmount) > 0.01) {
          throw new Error(`Total of custom splits (₹${customTotal.toFixed(2)}) must equal the total amount (₹${totalAmount.toFixed(2)})`);
        }
        splits = Object.entries(customSplits)
          .filter(([_, val]) => parseFloat(val) > 0)
          .map(([id, val]) => ({
            memberId: parseInt(id),
            amountOwed: parseFloat(val)
          }));
        
        if (splits.length === 0) {
          throw new Error("Please enter at least one custom split amount");
        }
      }

      const res = await fetch('/api/shared-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          amount: totalAmount,
          paidById,
          splitType,
          date: new Date(date).toISOString(),
          splits
        })
      });

      const data = await res.json();

      if (res.ok) {
        setShowForm(false);
        setTitle('');
        setAmount('');
        setCustomSplits({});
        fetchData();
      } else {
        throw new Error(data.error || "Failed to save expense");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this expense?')) {
      await fetch(`/api/shared-expenses/${id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <header>
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-white">Shared Expenses</h2>
          <p className="text-zinc-500 dark:text-zinc-400">Manage and split costs with your roommates.</p>
        </header>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
        >
          <Plus className="w-5 h-5" />
          Add Expense
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl animate-in fade-in slide-in-from-top-4">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Title</label>
                <input
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="e.g. Grocery Shopping"
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
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Paid By</label>
                <select
                  required
                  value={paidById}
                  onChange={e => setPaidById(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                >
                  <option value="">Select Member</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
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
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Split Type</label>
                <div className="flex gap-2">
                  {(['EQUAL', 'CUSTOM'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setSplitType(type)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                        splitType === type
                          ? "bg-indigo-600 text-white"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {splitType === 'EQUAL' && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Split Between</label>
                  <div className="grid grid-cols-2 gap-2">
                    {members.map(m => (
                      <label key={m.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedParticipants.includes(m.id)}
                          onChange={e => {
                            if (e.target.checked) setSelectedParticipants([...selectedParticipants, m.id]);
                            else setSelectedParticipants(selectedParticipants.filter(id => id !== m.id));
                          }}
                          className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                        />
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">{m.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {splitType === 'CUSTOM' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Custom Amounts</label>
                  <div className="space-y-2">
                    {members.map(m => (
                      <div key={m.id} className="grid grid-cols-[100px_1fr] items-center gap-3">
                        <span className="text-sm text-zinc-600 dark:text-zinc-400 truncate">{m.name}</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={customSplits[m.id] || ''}
                          onChange={e => setCustomSplits({ ...customSplits, [m.id]: e.target.value })}
                          className="w-full px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="md:col-span-2 flex justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-3 rounded-xl text-zinc-600 dark:text-zinc-400 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? "Saving..." : "Save Expense"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {expenses.map(exp => (
          <div key={exp.id} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                <ReceiptIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-zinc-900 dark:text-white">{exp.title}</h4>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(exp.date).toLocaleDateString()}</span>
                  <span>Paid by <span className="font-medium text-zinc-700 dark:text-zinc-300">{exp.paidBy.name}</span></span>
                  <span className="flex items-center gap-1"><Info className="w-3 h-3" /> {exp.splitType} Split</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-2xl font-bold text-zinc-900 dark:text-white">₹{exp.amount.toFixed(2)}</p>
                <p className="text-xs text-zinc-400">{exp.splits.length} participants</p>
              </div>
              <button
                onClick={() => handleDelete(exp.id)}
                className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReceiptIcon(props: any) {
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
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
      <path d="M12 17.5V6.5" />
    </svg>
  );
}
