import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    getPortfolio, optimizePortfolio, addHolding, applyRebalance,
    getOptimizationResult, CURRENCY_SYMBOLS, updateHolding, deleteHolding,
} from '../services/portfolioService';
import type { Portfolio } from '../services/portfolioService';
import { getLatestPrices, updatePrices, getSentiment } from '../services/marketService';
import type { SentimentData } from '../services/marketService';
import SentimentIndicator from '../components/SentimentIndicator';
import AllocationChart from '../components/AllocationChart';
import DriftAlert from '../components/DriftAlert';
import PortfolioHistoryChart from '../components/PortfolioHistoryChart';
import AnalyticsTab from '../components/AnalyticsTab';
import TickerSearch from '../components/TickerSearch';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

const TabBtn = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
        onClick={onClick}
        className="px-4 py-2.5 text-sm font-medium rounded-lg transition-all"
        style={active
            ? { background: 'var(--accent-dim)', color: 'var(--accent-hover)' }
            : { color: 'var(--text-secondary)', background: 'transparent' }
        }
    >
        {children}
    </button>
);

const PortfolioDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
    const [optimizationResult, setOptimizationResult] = useState<any>(null);
    const [explanation, setExplanation] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [applying, setApplying] = useState(false);
    const [prices, setPrices] = useState<Record<string, number>>({});
    const [sentimentData, setSentimentData] = useState<Record<string, SentimentData>>({});
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [holdingForm, setHoldingForm] = useState({ ticker: '', quantity: 0, avg_price: 0, currency: 'USD' });
    const [activeTab, setActiveTab] = useState<'overview' | 'analytics'>('overview');

    useEffect(() => {
        if (id) loadPortfolio(parseInt(id));
    }, [id]);

    useEffect(() => {
        if (!optimizationResult?.optimization_id || explanation) return;
        let id: ReturnType<typeof setInterval>;
        const poll = async () => {
            try {
                const res = await getOptimizationResult(optimizationResult.optimization_id);
                if (res.status === 'COMPLETED' && res.explanation) { setExplanation(res.explanation); clearInterval(id); }
                else if (res.status === 'FAILED') { setExplanation('Could not generate insights.'); clearInterval(id); }
            } catch { /* keep polling */ }
        };
        poll();
        id = setInterval(poll, 2000);
        return () => clearInterval(id);
    }, [optimizationResult, explanation]);

    const loadPortfolio = async (portfolioId: number) => {
        const data = await getPortfolio(portfolioId).catch(() => null);
        if (!data) return;
        setPortfolio(data);
        if (data.holdings.length > 0) {
            const tickers = data.holdings.map(h => h.ticker);
            updatePrices(tickers).then(() => fetchPrices(tickers)).catch(() => {});
            fetchPrices(tickers);
            fetchSentiment(tickers);
        }
    };

    const fetchPrices = async (tickers: string[]) => {
        const data = await getLatestPrices(tickers).catch(() => ({}));
        setPrices(data);
    };

    const fetchSentiment = async (tickers: string[]) => {
        const results: Record<string, SentimentData> = {};
        await Promise.all(tickers.map(async t => {
            try { results[t] = await getSentiment(t); } catch { /* no sentiment */ }
        }));
        setSentimentData(results);
    };

    const calculateCurrentWeights = () => {
        if (!portfolio) return {};
        const total = portfolio.total_value_usd || portfolio.holdings.reduce((s, h) => s + (h.value_in_usd || h.quantity * h.avg_price), 0);
        if (total === 0) return {};
        return Object.fromEntries(
            portfolio.holdings.map(h => [h.ticker, (h.value_in_usd || h.quantity * h.avg_price) / total])
        );
    };

    const handleOptimize = async () => {
        if (!id) return;
        setLoading(true);
        setExplanation(null);
        try {
            const result = await optimizePortfolio(parseInt(id));
            setOptimizationResult(result);
        } catch {
            alert('Optimization failed. Ensure market data is available.');
        } finally { setLoading(false); }
    };

    const handleAccept = async () => {
        if (!id || !optimizationResult) return;
        setApplying(true);
        try {
            await applyRebalance(parseInt(id), optimizationResult.optimized_weights);
            setOptimizationResult(null);
            loadPortfolio(parseInt(id));
        } catch { alert('Failed to apply rebalancing.'); }
        finally { setApplying(false); }
    };

    const handleSubmitHolding = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        try {
            if (isEditing) await updateHolding(parseInt(id), holdingForm.ticker, holdingForm);
            else await addHolding(parseInt(id), holdingForm);
            setShowModal(false);
            loadPortfolio(parseInt(id));
        } catch { alert('Failed to save holding.'); }
    };

    const handleDelete = async (ticker: string) => {
        if (!id || !confirm(`Remove ${ticker} from this portfolio?`)) return;
        try { await deleteHolding(parseInt(id), ticker); loadPortfolio(parseInt(id)); }
        catch { alert('Failed to delete holding.'); }
    };

    if (!portfolio) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
        </div>
    );

    const currentWeights = calculateCurrentWeights();
    const displayValue = portfolio.total_value_usd ?? 0;

    const isOptimal = optimizationResult && (() => {
        const t = optimizationResult.optimized_weights;
        const keys = new Set([...Object.keys(currentWeights), ...Object.keys(t)]);
        return Math.max(...Array.from(keys).map(k => Math.abs((currentWeights[k] ?? 0) - (t[k] ?? 0)))) < 0.01;
    })();

    return (
        <div className="space-y-5 fade-up">
            {/* Breadcrumb + header */}
            <div>
                <div className="flex items-center gap-2 text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                    <Link to="/" className="hover:text-[var(--accent)] transition-colors">Dashboard</Link>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span style={{ color: 'var(--text-secondary)' }}>{portfolio.name}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                            {portfolio.name}
                        </h1>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                            {portfolio.holdings.length} holdings
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-semibold mb-0.5 uppercase tracking-wider"
                            style={{ color: 'var(--text-muted)' }}>Total Value</p>
                        <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                            ${displayValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <TabBtn active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>Overview</TabBtn>
                <TabBtn active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')}>Risk & Analytics</TabBtn>
            </div>

            {activeTab === 'analytics' ? (
                <AnalyticsTab portfolioId={portfolio.id} />
            ) : (
                <>
                    {optimizationResult && (
                        <DriftAlert currentWeights={currentWeights} targetWeights={optimizationResult.optimized_weights} />
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        {/* Main column */}
                        <div className="lg:col-span-2 space-y-5">
                            {/* History chart */}
                            <div className="card p-5">
                                <h3 className="text-sm font-semibold mb-4"
                                    style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem' }}>
                                    Value History
                                </h3>
                                <PortfolioHistoryChart currentValue={displayValue} />
                            </div>

                            {/* Holdings table */}
                            <div className="card overflow-hidden">
                                <div className="px-5 py-4 flex items-center justify-between border-b"
                                    style={{ borderColor: 'var(--border)' }}>
                                    <h3 className="text-sm font-semibold"
                                        style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem' }}>
                                        Holdings
                                    </h3>
                                    <button
                                        onClick={() => { setIsEditing(false); setHoldingForm({ ticker: '', quantity: 0, avg_price: 0, currency: 'USD' }); setShowModal(true); }}
                                        className="btn btn-ghost text-xs px-2.5 py-1">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        Add holding
                                    </button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th className="text-left">Ticker</th>
                                                <th className="text-left">Sentiment</th>
                                                <th className="text-right">Qty</th>
                                                <th className="text-right">Avg Price</th>
                                                <th className="text-right">Cur Price</th>
                                                <th className="text-right">Value</th>
                                                <th className="text-right">Weight</th>
                                                <th />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {portfolio.holdings.map(holding => {
                                                const curPrice = prices[holding.ticker] ?? 0;
                                                const curValue = curPrice > 0 ? curPrice * holding.quantity : holding.value_in_usd ?? 0;
                                                const sym = CURRENCY_SYMBOLS[holding.currency] || '$';
                                                const weight = currentWeights[holding.ticker] ?? 0;
                                                const sentiment = sentimentData[holding.ticker];
                                                const pnlPct = holding.avg_price > 0 && curPrice > 0
                                                    ? ((curPrice - holding.avg_price) / holding.avg_price) * 100
                                                    : null;

                                                return (
                                                    <tr key={holding.ticker}>
                                                        <td>
                                                            <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                                {holding.ticker}
                                                            </div>
                                                            {pnlPct !== null && (
                                                                <div className="text-xs mt-0.5"
                                                                    style={{ color: pnlPct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                                                    {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <SentimentIndicator
                                                                score={sentiment?.score ?? null}
                                                                articleCount={sentiment?.article_count}
                                                                subjectivity={sentiment?.subjectivity}
                                                                loading={!sentiment}
                                                            />
                                                        </td>
                                                        <td className="text-right" style={{ color: 'var(--text-secondary)' }}>
                                                            {holding.quantity}
                                                        </td>
                                                        <td className="text-right" style={{ color: 'var(--text-secondary)' }}>
                                                            {sym}{holding.avg_price.toFixed(2)}
                                                        </td>
                                                        <td className="text-right" style={{ color: 'var(--text-primary)' }}>
                                                            {curPrice > 0 ? `${sym}${curPrice.toFixed(2)}` : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                                        </td>
                                                        <td className="text-right font-medium" style={{ color: 'var(--text-primary)' }}>
                                                            {curValue > 0 ? `${sym}${curValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                                        </td>
                                                        <td className="text-right">
                                                            <span className="badge badge-blue">
                                                                {(weight * 100).toFixed(1)}%
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div className="flex items-center justify-end gap-1">
                                                                <button
                                                                    onClick={() => { setIsEditing(true); setHoldingForm({ ticker: holding.ticker, quantity: holding.quantity, avg_price: holding.avg_price, currency: holding.currency }); setShowModal(true); }}
                                                                    className="w-7 h-7 flex items-center justify-center rounded transition-colors hover:bg-[var(--bg-hover)]"
                                                                    style={{ color: 'var(--text-muted)' }}>
                                                                    <PencilIcon className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDelete(holding.ticker)}
                                                                    className="w-7 h-7 flex items-center justify-center rounded transition-colors hover:bg-red-500/10"
                                                                    style={{ color: 'var(--text-muted)' }}>
                                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Right column */}
                        <div className="space-y-5">
                            {/* Allocation chart */}
                            <div className="card p-5">
                                <h3 className="text-xs font-semibold mb-4 uppercase tracking-wider"
                                    style={{ color: 'var(--text-secondary)' }}>Allocation</h3>
                                <div className="h-52">
                                    <AllocationChart holdings={portfolio.holdings} />
                                </div>
                            </div>

                            {/* Optimize card */}
                            <div className="card p-5">
                                <h3 className="text-xs font-semibold mb-1 uppercase tracking-wider"
                                    style={{ color: 'var(--text-secondary)' }}>AI Optimization</h3>
                                <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                                    Mean-variance optimization with sentiment weighting.
                                </p>
                                <button
                                    onClick={handleOptimize}
                                    disabled={loading}
                                    className="btn btn-primary w-full"
                                >
                                    {loading ? (
                                        <span className="flex items-center gap-2">
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Optimizing…
                                        </span>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                    d="M13 10V3L4 14h7v7l9-11h-7z" />
                                            </svg>
                                            Run Optimization
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Optimization result */}
                            {optimizationResult && (
                                <div className="card p-5 space-y-4"
                                    style={{ borderLeft: '3px solid var(--accent)' }}>
                                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                        Proposed Strategy
                                    </h3>

                                    {/* AI Explanation */}
                                    <div className="rounded-lg p-4" style={{ background: 'var(--bg-elevated)' }}>
                                        <p className="text-xs font-semibold mb-2 uppercase tracking-wider flex items-center gap-1.5"
                                            style={{ color: 'var(--accent)' }}>
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                    d="M13 10V3L4 14h7v7l9-11h-7z" />
                                            </svg>
                                            AI Analysis
                                        </p>
                                        {explanation ? (
                                            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                                {explanation}
                                            </p>
                                        ) : (
                                            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                                                <span className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin"
                                                    style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
                                                Generating insights…
                                            </div>
                                        )}
                                    </div>

                                    {/* Metrics */}
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            { label: 'Return', value: `${(optimizationResult.metrics.expected_return * 100).toFixed(2)}%`, color: 'var(--green)' },
                                            { label: 'Risk', value: `${(optimizationResult.metrics.volatility * 100).toFixed(2)}%`, color: 'var(--red)' },
                                            { label: 'Sharpe', value: optimizationResult.metrics.sharpe_ratio.toFixed(2), color: 'var(--text-primary)' },
                                        ].map(m => (
                                            <div key={m.label} className="rounded-lg p-3 text-center"
                                                style={{ background: 'var(--bg-elevated)' }}>
                                                <p className="text-lg font-bold" style={{ color: m.color, fontFamily: 'Outfit, sans-serif' }}>
                                                    {m.value}
                                                </p>
                                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{m.label}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Allocation changes */}
                                    <div>
                                        <p className="text-xs font-semibold mb-2 uppercase tracking-wider"
                                            style={{ color: 'var(--text-muted)' }}>Allocation Changes</p>
                                        <div className="space-y-2">
                                            {Object.entries(optimizationResult.optimized_weights).map(([ticker, weight]: [string, any]) => {
                                                const current = currentWeights[ticker] ?? 0;
                                                const delta = weight - current;
                                                return (
                                                    <div key={ticker} className="flex items-center justify-between text-xs">
                                                        <span className="font-medium w-16" style={{ color: 'var(--text-primary)' }}>{ticker}</span>
                                                        <div className="flex-1 mx-3 h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                                                            <div className="h-full rounded-full transition-all"
                                                                style={{ width: `${Math.min(weight * 100, 100)}%`, background: 'var(--accent)' }} />
                                                        </div>
                                                        <span style={{ color: 'var(--text-secondary)', minWidth: '36px', textAlign: 'right' }}>
                                                            {(weight * 100).toFixed(1)}%
                                                        </span>
                                                        <span className="ml-2 w-12 text-right font-semibold"
                                                            style={{ color: delta > 0.001 ? 'var(--green)' : delta < -0.001 ? 'var(--red)' : 'var(--text-muted)' }}>
                                                            {delta > 0.001 ? '+' : ''}{(delta * 100).toFixed(1)}%
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="flex gap-2 pt-1">
                                        <button
                                            onClick={handleAccept}
                                            disabled={applying || isOptimal}
                                            className="btn flex-1"
                                            style={{
                                                background: isOptimal ? 'var(--bg-elevated)' : 'rgba(34,197,94,0.15)',
                                                color: isOptimal ? 'var(--text-muted)' : '#4ade80',
                                                border: `1px solid ${isOptimal ? 'var(--border)' : 'rgba(34,197,94,0.3)'}`,
                                            }}>
                                            {applying ? 'Applying…' : isOptimal ? 'Already optimal' : 'Accept'}
                                        </button>
                                        <button
                                            onClick={() => { setOptimizationResult(null); setExplanation(null); }}
                                            className="btn btn-ghost flex-1">
                                            Dismiss
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Add / Edit holding modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="w-full max-w-sm rounded-xl shadow-2xl p-6 fade-up"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                                {isEditing ? 'Edit Holding' : 'Add Holding'}
                            </h3>
                            <button onClick={() => setShowModal(false)}
                                className="w-7 h-7 flex items-center justify-center rounded"
                                style={{ color: 'var(--text-muted)' }}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSubmitHolding} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
                                    style={{ color: 'var(--text-secondary)' }}>Ticker</label>
                                {isEditing ? (
                                    <input type="text" disabled value={holdingForm.ticker} className="w-full px-3 py-2.5 text-sm opacity-50" />
                                ) : (
                                    <>
                                        <TickerSearch
                                            onSelect={ticker => setHoldingForm({ ...holdingForm, ticker })}
                                            placeholder="Search e.g. AAPL"
                                        />
                                        {holdingForm.ticker && (
                                            <p className="text-xs mt-1" style={{ color: 'var(--accent)' }}>
                                                Selected: {holdingForm.ticker}
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
                                        style={{ color: 'var(--text-secondary)' }}>Quantity</label>
                                    <input
                                        type="number" required step="any" min="0"
                                        value={holdingForm.quantity || ''}
                                        onChange={e => setHoldingForm({ ...holdingForm, quantity: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3 py-2.5 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
                                        style={{ color: 'var(--text-secondary)' }}>Avg Price</label>
                                    <input
                                        type="number" required step="any" min="0"
                                        value={holdingForm.avg_price || ''}
                                        onChange={e => setHoldingForm({ ...holdingForm, avg_price: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3 py-2.5 text-sm"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
                                    style={{ color: 'var(--text-secondary)' }}>Currency</label>
                                <select
                                    value={holdingForm.currency}
                                    onChange={e => setHoldingForm({ ...holdingForm, currency: e.target.value })}
                                    className="w-full px-3 py-2.5 text-sm"
                                >
                                    <option value="USD">$ USD</option>
                                    <option value="EUR">€ EUR</option>
                                    <option value="INR">₹ INR</option>
                                </select>
                            </div>

                            <div className="flex gap-2 pt-1">
                                <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost flex-1">
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary flex-1">
                                    {isEditing ? 'Save Changes' : 'Add Holding'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PortfolioDetails;
