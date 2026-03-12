import React, { useEffect, useState } from 'react';
import { UserPlus, Trash2, User, ShieldCheck } from 'lucide-react';
import { Member } from '../types';

export default function Members() {
  const [members, setMembers] = useState<Member[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/members');
      const contentType = res.headers.get("content-type");
      let data;
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        throw new Error(await res.text() || "Failed to fetch members");
      }

      if (res.ok) {
        setMembers(Array.isArray(data) ? data : []);
      } else {
        setError(data.error || 'Failed to fetch members');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });
      if (res.ok) {
        setNewName('');
        await fetchMembers();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to add member');
      }
    } catch (err) {
      setError('Failed to add member. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    setError('');
    setIsDeleting(id);
    try {
      const res = await fetch(`/api/members/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchMembers();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to delete member');
      }
    } catch (err) {
      setError('Failed to delete member. Please try again.');
    } finally {
      setIsDeleting(null);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto">
      <header>
        <h2 className="text-3xl font-bold text-zinc-900 dark:text-white">Member Management</h2>
        <p className="text-zinc-500 dark:text-zinc-400">Add or remove roommates from the system.</p>
      </header>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <form onSubmit={handleAdd} className="flex gap-3">
          <input
            required
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="flex-1 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            placeholder="Enter new member name..."
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
          >
            {isSubmitting ? "Adding..." : (
              <>
                <UserPlus className="w-5 h-5" />
                Add Member
              </>
            )}
          </button>
        </form>
      </section>

      <div className="grid grid-cols-1 gap-4">
        {members.map(m => (
          <div key={m.id} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-zinc-900 dark:text-white">{m.name}</h4>
                <p className="text-sm text-zinc-500">Joined {new Date(m.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDelete(m.id)}
                disabled={isDeleting === m.id}
                className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all disabled:opacity-50"
                title="Delete Member"
              >
                {isDeleting === m.id ? (
                  <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-800 flex gap-4">
        <ShieldCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400 shrink-0" />
        <p className="text-sm text-indigo-700 dark:text-indigo-300">
          <strong>Note:</strong> Members can only be removed if they have no associated expenses, splits, or settlements. This ensures data integrity.
        </p>
      </div>
    </div>
  );
}
