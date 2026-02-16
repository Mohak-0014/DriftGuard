import React, { useEffect, useState } from 'react';
import { getPortfolioAnalytics } from '../services/portfolioService';
import type { PortfolioAnalytics } from '../services/portfolioService';
import VolatilityTrendChart from './VolatilityTrendChart';

interface AnalyticsTabProps {
    portfolioId: number;
}

const MetricCard: React.FC<{ title: string; value: string | number; description: string; color?: string }> = ({ title, value, description, color = "text-slate-900" }) => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
        <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</h3>
        <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
        <p className="text-xs text-slate-500 mt-1">{description}</p>
    </div>
);

const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ portfolioId }) => {
    const [analytics, setAnalytics] = useState<PortfolioAnalytics | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAnalytics = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await getPortfolioAnalytics(portfolioId);
                setAnalytics(data);
            } catch (err) {
                console.error("Failed to fetch analytics", err);
                // Check if 400 (insufficient data) or other error
                setError("Data unavailable. Ensure at least 1 year of price history exists for all assets.");
            } finally {
                setLoading(false);
            }
        };

        if (portfolioId) {
            fetchAnalytics();
        }
    }, [portfolioId]);

    if (loading) return (
        <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
    );

    if (error) return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
            <p className="text-amber-700 font-medium">Analysis Unavailable</p>
            <p className="text-amber-600 text-sm mt-1">{error}</p>
        </div>
    );

    if (!analytics) return null;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <MetricCard
                    title="Sharpe Ratio"
                    value={analytics.sharpe_ratio.toFixed(2)}
                    description="Return per unit of risk (higher is better)"
                    color={analytics.sharpe_ratio > 1 ? "text-green-600" : (analytics.sharpe_ratio < 0 ? "text-red-600" : "text-slate-900")}
                />
                <MetricCard
                    title="Sortino Ratio"
                    value={analytics.sortino_ratio.toFixed(2)}
                    description="Return per unit of downside risk"
                    color={analytics.sortino_ratio > 1 ? "text-green-600" : "text-slate-900"}
                />
                <MetricCard
                    title="Max Drawdown"
                    value={`${(analytics.max_drawdown * 100).toFixed(2)}%`}
                    description="Maximum observed loss from peak to trough"
                    color="text-red-600"
                />
                <MetricCard
                    title="Value at Risk (95%)"
                    value={`${(analytics.value_at_risk_95 * 100).toFixed(2)}%`}
                    description="Max expected daily loss with 95% confidence"
                />
                <MetricCard
                    title="Volatility (Ann.)"
                    value={`${(analytics.volatility * 100).toFixed(2)}%`}
                    description="Standard deviation of returns (annualized)"
                />
            </div>

            {/* Volatility Trend Chart */}
            <div className="bg-white shadow-sm border border-slate-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Volatility Trend (30-Day Rolling)</h3>
                <div className="h-64">
                    <VolatilityTrendChart data={analytics.volatility_history || []} />
                </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-500">
                <p>
                    <strong>Note:</strong> Metrics are calculated based on 2 years of historical data assuming current portfolio weights were held constant (Backcast). Risk-free rate assumed to be 0%.
                </p>
            </div>
        </div>
    );
};

export default AnalyticsTab;
