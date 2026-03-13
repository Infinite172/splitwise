import React, { useEffect, useState } from 'react';
import { CheckCircle2, History, ArrowRight, Plus, ArrowUpRight, Loader2, Download } from 'lucide-react';
import { Member, Settlement, BalancesResponse } from '../types';
import { motion } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Settlements() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [balances, setBalances] = useState<BalancesResponse | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isSettling, setIsSettling] = useState<number | null>(null);
  
  // Form State
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [setRes, memRes, balRes] = await Promise.all([
        fetch('/api/settlements'),
        fetch('/api/members'),
        fetch('/api/balances')
      ]);
      
      const parse = async (res: Response) => {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) return await res.json();
        return { error: await res.text() || "Server error" };
      };

      if (setRes.ok && memRes.ok && balRes.ok) {
        setSettlements(await setRes.json());
        setMembers(await memRes.json());
        setBalances(await balRes.json());
      } else {
        const setErr = !setRes.ok ? await parse(setRes) : null;
        const memErr = !memRes.ok ? await parse(memRes) : null;
        setError(setErr?.error || memErr?.error || 'Failed to fetch data. Please check your database connection.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      if (fromId === toId) {
        throw new Error("Cannot settle debt with the same person");
      }
      const amt = parseFloat(amount);
      if (isNaN(amt) || amt <= 0) {
        throw new Error("Please enter a valid amount greater than 0");
      }
      await createSettlement(parseInt(fromId), parseInt(toId), amt, new Date(date).toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const createSettlement = async (from: number, to: number, amt: number, settlementDate?: string) => {
    const res = await fetch('/api/settlements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromMemberId: from,
        toMemberId: to,
        amount: amt,
        date: settlementDate || new Date().toISOString()
      })
    });
    
    if (res.ok) {
      setShowForm(false);
      setFromId('');
      setToId('');
      setAmount('');
      fetchData();
    } else {
      const data = await res.json();
      throw new Error(data.error || "Failed to record settlement");
    }
  };

  const handleMarkAsSettled = async (from: number, to: number, amt: number, index: number) => {
    setIsSettling(index);
    await createSettlement(from, to, amt);
    setIsSettling(null);
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(16, 185, 129); // Emerald-600
    doc.text('Settlement History Report', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
    
    // Table
    const tableData = settlements.map(s => [
      new Date(s.date).toLocaleDateString(),
      s.fromMember.name,
      s.toMember.name,
      `INR ${s.amount.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Date', 'From (Debtor)', 'To (Creditor)', 'Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] },
      styles: { fontSize: 9 },
    });

    doc.save('settlement-history.pdf');
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <header>
          <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">Settlements</h2>
          <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400">Record payments and clear debts between roommates.</p>
        </header>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={downloadPDF}
            className="flex-1 sm:flex-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm sm:text-base"
          >
            <Download className="w-4 h-4 sm:w-5 sm:h-5" />
            Export PDF
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 text-sm sm:text-base"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            Record Payment
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl animate-in fade-in slide-in-from-top-4">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">From (Debtor)</label>
              <select
                required
                value={fromId}
                onChange={e => setFromId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              >
                <option value="">Select Member</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">To (Creditor)</label>
              <select
                required
                value={toId}
                onChange={e => setToId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              >
                <option value="">Select Member</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Amount (₹)</label>
              <input
                required
                type="number"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Date</label>
              <input
                required
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
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
                disabled={isSubmitting}
                className="px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? "Saving..." : "Confirm Settlement"}
              </button>
            </div>
          </form>
        </div>
      )}

      <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <h3 className="text-xl font-semibold mb-4 text-zinc-900 dark:text-white">Pending Settlements</h3>
        <div className="space-y-4">
          {balances?.simplified.length === 0 ? (
            <p className="text-zinc-500 italic py-4 text-center">All settled up! No pending debts.</p>
          ) : (
            balances?.simplified.map((s, idx) => {
              const from = members.find(m => m.id === s.from)?.name;
              const to = members.find(m => m.id === s.to)?.name;
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={idx}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl group gap-4"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-medium text-zinc-900 dark:text-white">{from}</span>
                    <ArrowUpRight className="w-4 h-4 text-red-500" />
                    <span className="font-medium text-zinc-900 dark:text-white">{to}</span>
                    <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                      ₹{s.amount.toFixed(2)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleMarkAsSettled(s.from, s.to, s.amount, idx)}
                    disabled={isSettling === idx}
                    className="w-full sm:w-auto bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    {isSettling === idx ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Mark as Settled
                  </button>
                </motion.div>
              );
            })
          )}
        </div>
      </section>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
          <History className="w-5 h-5 text-zinc-400" />
          <h3 className="text-xl font-semibold text-zinc-900 dark:text-white">Settlement History</h3>
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {settlements.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 italic">No settlements recorded yet.</div>
          ) : (
            settlements.map(s => (
              <div key={s.id} className="p-6 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-zinc-900 dark:text-white font-medium">
                      <span>{s.fromMember.name}</span>
                      <ArrowRight className="w-4 h-4 text-zinc-400" />
                      <span>{s.toMember.name}</span>
                    </div>
                    <p className="text-sm text-zinc-500">{new Date(s.date).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  ₹{s.amount.toFixed(2)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
