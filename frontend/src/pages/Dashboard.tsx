import React, { useEffect, useState } from 'react';
import { getPortfolios, type Portfolio } from '../services/portfolioService';
import { Link } from 'react-router-dom';

const StatPill = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <div>
        <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: 600 }}>
            {label}
        </p>
        <p className="text-sm font-semibold" style={{ color: color ?? 'var(--text-primary)' }}>{value}</p>
    </div>
);

const PortfolioCard = ({ portfolio }: { portfolio: Portfolio }) => {
    const value = portfolio.total_value_usd ?? 0;
    const holdingCount = portfolio.holdings.length;

    return (
        <Link to={`/portfolio/${portfolio.id}`} className="block group">
            <div className="card p-5 transition-all duration-200 hover:border-[var(--border-light)] hover:-translate-y-0.5 hover:shadow-lg"
                style={{ boxShadow: 'none' }}>
                {/* Top row */}
                <div className="flex items-start justify-between mb-5">
                    <div className="flex-1 min-w-0">
                        <h2 className="text-base font-semibold truncate"
                            style={{ color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                            {portfolio.name}
                        </h2>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {holdingCount} holding{holdingCount !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ml-3"
                        style={{ background: 'var(--accent-dim)' }}>
                        <svg className="w-4 h-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                    </div>
                </div>

                {/* Ticker chips */}
                <div className="flex flex-wrap gap-1.5 mb-5">
                    {portfolio.holdings.slice(0, 5).map(h => (
                        <span key={h.ticker} className="badge badge-blue">{h.ticker}</span>
                    ))}
                    {portfolio.holdings.length > 5 && (
                        <span className="badge" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                            +{portfolio.holdings.length - 5}
                        </span>
                    )}
                </div>

                {/* Value */}
                <div className="pt-4 border-t flex items-end justify-between" style={{ borderColor: 'var(--border)' }}>
                    <div>
                        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em', fontWeight: 600 }}>
                            Total Value
                        </p>
                        <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                            ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                    <div className="text-sm font-medium flex items-center gap-1"
                        style={{ color: 'var(--accent)' }}>
                        View details
                        <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                </div>
            </div>
        </Link>
    );
};

const Dashboard: React.FC = () => {
    const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getPortfolios()
            .then(setPortfolios)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const totalValue = portfolios.reduce((s, p) => s + (p.total_value_usd ?? 0), 0);
    const totalHoldings = new Set(portfolios.flatMap(p => p.holdings.map(h => h.ticker))).size;

    return (
        <div className="space-y-6 fade-up">
            {/* Summary strip */}
            {!loading && portfolios.length > 0 && (
                <div className="card px-5 py-4">
                    <div className="flex flex-wrap gap-8">
                        <StatPill
                            label="Total Assets"
                            value={`$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            color="var(--text-primary)"
                        />
                        <StatPill label="Portfolios" value={portfolios.length.toString()} />
                        <StatPill label="Unique Tickers" value={totalHoldings.toString()} />
                    </div>
                </div>
            )}

            {/* Header row */}
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.7rem' }}>
                    Your Portfolios
                </h2>
                <Link to="/onboarding" className="btn btn-primary text-xs px-3 py-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    New Portfolio
                </Link>
            </div>

            {/* Skeleton */}
            {loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="card p-5 space-y-3">
                            <div className="skeleton h-4 w-2/3" />
                            <div className="skeleton h-3 w-1/3" />
                            <div className="flex gap-1.5 mt-2">
                                {[1, 2, 3].map(j => <div key={j} className="skeleton h-5 w-12 rounded-full" />)}
                            </div>
                            <div className="skeleton h-7 w-1/2 mt-4" />
                        </div>
                    ))}
                </div>
            )}

            {/* Portfolio grid */}
            {!loading && portfolios.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {portfolios.map(p => <PortfolioCard key={p.id} portfolio={p} />)}
                </div>
            )}

            {/* Empty state */}
            {!loading && portfolios.length === 0 && (
                <div className="card flex flex-col items-center py-16 px-6 text-center">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                        style={{ background: 'var(--bg-elevated)' }}>
                        <svg className="w-7 h-7" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    </div>
                    <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                        No portfolios yet
                    </h3>
                    <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                        Create your first portfolio to start tracking and optimizing.
                    </p>
                    <Link to="/onboarding" className="btn btn-primary">
                        Create Portfolio
                    </Link>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
