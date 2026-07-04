import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortfolio, type Holding } from '../services/portfolioService';
import TickerSearch from '../components/TickerSearch';

const CURRENCIES = [
    { code: 'USD', symbol: '$' },
    { code: 'EUR', symbol: '€' },
    { code: 'INR', symbol: '₹' },
];

const emptyHolding = (): Holding => ({ ticker: '', quantity: 0, avg_price: 0, currency: 'USD' });

const Onboarding: React.FC = () => {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [holdings, setHoldings] = useState<Holding[]>([emptyHolding()]);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const updateHolding = (i: number, field: keyof Holding, value: string | number) => {
        setHoldings(prev => {
            const next = [...prev];
            (next[i] as any)[field] = value;
            return next;
        });
    };

    const addRow = () => setHoldings(prev => [...prev, emptyHolding()]);
    const removeRow = (i: number) => setHoldings(prev => prev.filter((_, idx) => idx !== i));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!name.trim()) { setError('Portfolio name is required'); return; }
        const valid = holdings.filter(h => h.ticker.trim() && h.quantity > 0);
        if (valid.length === 0) { setError('Add at least one holding with a ticker and quantity > 0'); return; }
        setSubmitting(true);
        try {
            await createPortfolio(name, valid);
            navigate('/');
        } catch {
            setError('Failed to create portfolio. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto fade-up">
            <div className="mb-6">
                <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                    Create Portfolio
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                    Enter your holdings to get AI-powered rebalancing recommendations.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Portfolio name */}
                <div className="card p-5">
                    <label className="block text-xs font-semibold mb-2"
                        style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Portfolio Name
                    </label>
                    <input
                        type="text"
                        placeholder="e.g. Retirement 2050"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full px-3 py-2.5 text-sm"
                    />
                </div>

                {/* Holdings */}
                <div className="card">
                    <div className="px-5 py-4 border-b flex items-center justify-between"
                        style={{ borderColor: 'var(--border)' }}>
                        <span className="text-xs font-semibold uppercase tracking-wider"
                            style={{ color: 'var(--text-secondary)' }}>Holdings</span>
                        <button type="button" onClick={addRow} className="btn btn-ghost text-xs px-2.5 py-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add row
                        </button>
                    </div>

                    {/* Column headers */}
                    <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-2 text-xs font-semibold uppercase tracking-wider"
                        style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                        <div className="col-span-4">Ticker</div>
                        <div className="col-span-3">Quantity</div>
                        <div className="col-span-3">Avg Price</div>
                        <div className="col-span-1">CCY</div>
                        <div className="col-span-1" />
                    </div>

                    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                        {holdings.map((h, i) => (
                            <div key={i} className="grid grid-cols-12 gap-3 px-5 py-3 items-center">
                                <div className="col-span-12 sm:col-span-4">
                                    <TickerSearch
                                        onSelect={ticker => updateHolding(i, 'ticker', ticker)}
                                        placeholder="Search AAPL…"
                                        className=""
                                    />
                                    {h.ticker && (
                                        <p className="text-xs mt-1" style={{ color: 'var(--accent)' }}>{h.ticker}</p>
                                    )}
                                </div>
                                <div className="col-span-5 sm:col-span-3">
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        placeholder="10"
                                        value={h.quantity || ''}
                                        onChange={e => updateHolding(i, 'quantity', parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-2 text-sm"
                                    />
                                </div>
                                <div className="col-span-5 sm:col-span-3">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="150.00"
                                        value={h.avg_price || ''}
                                        onChange={e => updateHolding(i, 'avg_price', parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-2 text-sm"
                                    />
                                </div>
                                <div className="col-span-10 sm:col-span-1">
                                    <select
                                        value={h.currency}
                                        onChange={e => updateHolding(i, 'currency', e.target.value)}
                                        className="w-full px-2 py-2 text-sm"
                                    >
                                        {CURRENCIES.map(c => (
                                            <option key={c.code} value={c.code}>{c.symbol}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-2 sm:col-span-1 flex justify-end">
                                    {holdings.length > 1 && (
                                        <button type="button" onClick={() => removeRow(i)}
                                            className="w-7 h-7 flex items-center justify-center rounded transition-colors hover:bg-red-500/10"
                                            style={{ color: 'var(--text-muted)' }}>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {error && (
                    <div className="px-4 py-3 rounded-lg text-sm"
                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                        {error}
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-1">
                    <button type="button" onClick={() => navigate('/')} className="btn btn-ghost">
                        Cancel
                    </button>
                    <button type="submit" disabled={submitting} className="btn btn-primary px-6">
                        {submitting ? (
                            <span className="flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Creating…
                            </span>
                        ) : 'Create Portfolio'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default Onboarding;
