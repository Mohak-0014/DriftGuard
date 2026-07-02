import React, { useEffect, useState } from 'react';
import { getPortfolioAnalytics } from '../services/portfolioService';
import type { PortfolioAnalytics } from '../services/portfolioService';
import VolatilityTrendChart from './VolatilityTrendChart';

interface AnalyticsTabProps { portfolioId: number; }

const MetricCard = ({
    title, value, description, color,
}: { title: string; value: string; description: string; color?: string }) => (
    <div className="card p-5">
        <p className="text-xs font-semibold mb-2 uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}>{title}</p>
        <p className="text-3xl font-bold mb-1"
            style={{ color: color ?? 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>
            {value}
        </p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{description}</p>
    </div>
);

const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ portfolioId }) => {
    const [analytics, setAnalytics] = useState<PortfolioAnalytics | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!portfolioId) return;
        setLoading(true);
        setError(null);
        getPortfolioAnalytics(portfolioId)
            .then(setAnalytics)
            .catch(() => setError('Insufficient data. Ensure at least 1 year of price history exists for all holdings.'))
            .finally(() => setLoading(false));
    }, [portfolioId]);

    if (loading) return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="card p-5">
                    <div className="skeleton h-3 w-1/3 mb-3" />
                    <div className="skeleton h-8 w-1/2 mb-2" />
                    <div className="skeleton h-3 w-3/4" />
                </div>
            ))}
        </div>
    );

    if (error) return (
        <div className="card p-6 text-center">
            <svg className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Analysis unavailable</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{error}</p>
        </div>
    );

    if (!analytics) return null;

    const sharpeColor = analytics.sharpe_ratio > 1 ? 'var(--green)' : analytics.sharpe_ratio < 0 ? 'var(--red)' : 'var(--text-primary)';

    return (
        <div className="space-y-5 fade-up">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <MetricCard
                    title="Sharpe Ratio"
                    value={analytics.sharpe_ratio.toFixed(2)}
                    description="Return per unit of risk — higher is better"
                    color={sharpeColor}
                />
                <MetricCard
                    title="Sortino Ratio"
                    value={analytics.sortino_ratio.toFixed(2)}
                    description="Return per unit of downside risk"
                    color={analytics.sortino_ratio > 1 ? 'var(--green)' : 'var(--text-primary)'}
                />
                <MetricCard
                    title="Max Drawdown"
                    value={`${(analytics.max_drawdown * 100).toFixed(2)}%`}
                    description="Largest peak-to-trough loss observed"
                    color="var(--red)"
                />
                <MetricCard
                    title="VaR (95%)"
                    value={`${(analytics.value_at_risk_95 * 100).toFixed(2)}%`}
                    description="Max expected daily loss with 95% confidence"
                />
                <MetricCard
                    title="Volatility (Ann.)"
                    value={`${(analytics.volatility * 100).toFixed(2)}%`}
                    description="Annualized standard deviation of daily returns"
                />
            </div>

            <div className="card p-5">
                <h3 className="text-xs font-semibold mb-4 uppercase tracking-wider"
                    style={{ color: 'var(--text-secondary)' }}>
                    30-Day Rolling Volatility
                </h3>
                <div className="h-56">
                    <VolatilityTrendChart data={analytics.volatility_history ?? []} />
                </div>
            </div>

            <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
                Metrics based on 2 years of historical price data with current weights held constant (backcast). Risk-free rate: 0%.
            </p>
        </div>
    );
};

export default AnalyticsTab;
