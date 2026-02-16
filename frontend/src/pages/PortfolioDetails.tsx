import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPortfolio, optimizePortfolio, addHolding, applyRebalance, getOptimizationResult, CURRENCY_SYMBOLS } from '../services/portfolioService';
import type { Portfolio } from '../services/portfolioService';
import { getLatestPrices, updatePrices, getSentiment } from '../services/marketService';
import type { SentimentData } from '../services/marketService';
import SentimentIndicator from '../components/SentimentIndicator';
import AllocationChart from '../components/AllocationChart';
import DriftAlert from '../components/DriftAlert';
import PortfolioHistoryChart from '../components/PortfolioHistoryChart';
import AnalyticsTab from '../components/AnalyticsTab';

const PortfolioDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
    const [optimizationResult, setOptimizationResult] = useState<any>(null);
    const [explanation, setExplanation] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [logging, setLogging] = useState(false); // State for logging action
    const [prices, setPrices] = useState<Record<string, number>>({});
    const [sentimentData, setSentimentData] = useState<Record<string, SentimentData>>({});
    const [showAddModal, setShowAddModal] = useState(false);
    const [newHolding, setNewHolding] = useState({ ticker: '', quantity: 0, avg_price: 0, currency: 'USD' });
    const [activeTab, setActiveTab] = useState<'overview' | 'analytics'>('overview');

    useEffect(() => {
        if (id) {
            loadPortfolio(parseInt(id));
        }
    }, [id]);

    // Poll for explanation
    useEffect(() => {
        let intervalId: ReturnType<typeof setInterval>;
        if (optimizationResult?.optimization_id && !explanation) {
            const pollExplanation = async () => {
                try {
                    const res = await getOptimizationResult(optimizationResult.optimization_id);
                    if (res.status === 'COMPLETED' && res.explanation) {
                        setExplanation(res.explanation);
                        clearInterval(intervalId);
                    } else if (res.status === 'FAILED') {
                        setExplanation("Failed to generate insights.");
                        clearInterval(intervalId);
                    }
                } catch (e) {
                    console.error("Polling failed", e);
                }
            };

            pollExplanation(); // Initial check
            intervalId = setInterval(pollExplanation, 2000); // Poll every 2s
        }
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [optimizationResult, explanation]);

    const loadPortfolio = async (portfolioId: number) => {
        try {
            const data = await getPortfolio(portfolioId);
            setPortfolio(data);
            if (data && data.holdings.length > 0) {
                const tickers = data.holdings.map(h => h.ticker);

                // Fetch Prices
                updatePrices(tickers).then(() => {
                    fetchPrices(tickers);
                }).catch(err => console.error("Update failed", err));
                fetchPrices(tickers);

                // Fetch Sentiment
                fetchSentiment(tickers);
            }
        } catch (error) {
            console.error("Failed to load portfolio", error);
        }
    };

    const fetchSentiment = async (tickers: string[]) => {
        const data: Record<string, SentimentData> = {};
        await Promise.all(tickers.map(async (t) => {
            try {
                const s = await getSentiment(t);
                data[t] = s;
            } catch (e) {
                console.error(`Failed to fetch sentiment for ${t}`, e);
            }
        }));
        setSentimentData(data);
    };

    const fetchPrices = async (tickers: string[]) => {
        try {
            const priceData = await getLatestPrices(tickers);
            setPrices(priceData);
        } catch (error) {
            console.error("Failed to fetch prices", error);
        }
    };

    const handleAddHolding = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        try {
            await addHolding(parseInt(id), newHolding);
            setShowAddModal(false);
            setNewHolding({ ticker: '', quantity: 0, avg_price: 0, currency: 'USD' });
            loadPortfolio(parseInt(id)); // Reload to get updated list
        } catch (error) {
            console.error("Failed to add holding", error);
            alert("Failed to add holding.");
        }
    };

    const handleOptimize = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const result = await optimizePortfolio(parseInt(id));
            setOptimizationResult(result);
            setExplanation(null); // Clear previous explanation
        } catch (error) {
            console.error("Optimization failed", error);
            alert("Optimization failed. Ensure market data is available.");
        } finally {
            setLoading(false);
        }
    };

    // Calculate current weights helper - uses USD-normalized values
    const calculateCurrentWeights = () => {
        if (!portfolio) return {};
        const totalValueUsd = portfolio.total_value_usd || portfolio.holdings.reduce(
            (sum, h) => sum + (h.value_in_usd || h.quantity * h.avg_price), 0
        );
        const weights: Record<string, number> = {};
        if (totalValueUsd > 0) {
            portfolio.holdings.forEach(h => {
                const valueUsd = h.value_in_usd || h.quantity * h.avg_price;
                weights[h.ticker] = valueUsd / totalValueUsd;
            });
        }
        return weights;
    };

    const handleAccept = async () => {
        if (!id || !optimizationResult || !portfolio) return;
        setLogging(true);
        try {
            // Call apply endpoint to update holdings
            await applyRebalance(parseInt(id), optimizationResult.optimized_weights);
            alert("Portfolio rebalanced successfully! Holdings have been updated.");
            setOptimizationResult(null); // Clear result after accepting
            // Reload portfolio to show updated holdings
            loadPortfolio(parseInt(id));
        } catch (error) {
            console.error("Failed to apply rebalance", error);
            alert("Failed to apply rebalancing strategy.");
        } finally {
            setLogging(false);
        }
    };

    if (!portfolio) return (
        <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
    );

    // Calculate current weights for DriftAlert
    const currentWeights = calculateCurrentWeights();

    // Check if optimal
    const isOptimal = optimizationResult && (() => {
        const targetWeights = optimizationResult.optimized_weights;
        const tickers = new Set([...Object.keys(currentWeights), ...Object.keys(targetWeights)]);
        let maxDeviation = 0;
        tickers.forEach(ticker => {
            const current = currentWeights[ticker] || 0;
            const target = targetWeights[ticker] || 0;
            maxDeviation = Math.max(maxDeviation, Math.abs(current - target));
        });
        return maxDeviation < 0.01; // Less than 1% deviation
    })();

    // Calculate total value for display (sum of USD values)
    const displayTotalValue = portfolio.total_value_usd || 0;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white shadow-sm border border-slate-200 rounded-lg p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div>
                    <div className="flex items-center space-x-2 text-sm text-slate-500 mb-1">
                        <Link to="/" className="hover:text-indigo-600 transition-colors">Dashboard</Link>
                        <span>/</span>
                        <span>Portfolio Details</span>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{portfolio.name}</h1>
                </div>
                <div className="mt-4 sm:mt-0 text-right">
                    <p className="text-sm font-medium text-slate-500">Total Value (USD)</p>
                    <p className="text-4xl font-bold text-indigo-600 tracking-tight">
                        ${displayTotalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`${activeTab === 'overview'
                            ? 'border-indigo-500 text-indigo-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('analytics')}
                        className={`${activeTab === 'analytics'
                            ? 'border-indigo-500 text-indigo-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                    >
                        Risk & Performance
                    </button>
                </nav>
            </div>

            {activeTab === 'analytics' ? (
                <AnalyticsTab portfolioId={portfolio.id} />
            ) : (
                <>
                    {optimizationResult && (
                        <DriftAlert
                            currentWeights={currentWeights}
                            targetWeights={optimizationResult.optimized_weights}
                        />
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Column: History & Stats */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* History Chart */}
                            <div className="bg-white shadow-sm border border-slate-200 rounded-lg p-6">
                                <h3 className="text-lg font-semibold text-slate-900 mb-4">Value History</h3>
                                <PortfolioHistoryChart currentValue={displayTotalValue} />
                            </div>

                            {/* Holdings Table */}
                            <div className="bg-white shadow-sm border border-slate-200 rounded-lg overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                                    <h3 className="text-lg font-semibold text-slate-900">Holdings</h3>
                                    <button
                                        onClick={() => setShowAddModal(true)}
                                        className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-3 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm"
                                    >
                                        + Add Stock
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-slate-200">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Ticker</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Sentiment</th>
                                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Qty</th>
                                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Avg Price</th>
                                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Cur Price</th>
                                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Current Value</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-slate-200">
                                            {portfolio.holdings.map((holding) => {
                                                const currentPrice = prices[holding.ticker] || 0;
                                                const currentValue = currentPrice * holding.quantity;
                                                const holdingSymbol = CURRENCY_SYMBOLS[holding.currency] || '$';
                                                const sentiment = sentimentData[holding.ticker];

                                                return (
                                                    <tr key={holding.ticker} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{holding.ticker}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                                            <SentimentIndicator
                                                                score={sentiment?.score ?? null}
                                                                articleCount={sentiment?.article_count}
                                                                subjectivity={sentiment?.subjectivity}
                                                                loading={!sentiment && !sentimentData}
                                                            />
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 text-right">{holding.quantity}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 text-right">{holdingSymbol}{holding.avg_price.toFixed(2)}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 text-right">
                                                            {currentPrice > 0 ? `${holdingSymbol}${currentPrice.toFixed(2)}` : '-'}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 text-right">
                                                            {currentValue > 0 ? `${holdingSymbol}${currentValue.toFixed(2)}` : '-'}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Optimization & Actions */}
                        <div className="space-y-6">
                            {/* Allocation Chart */}
                            <div className="bg-white shadow-sm border border-slate-200 rounded-lg p-6">
                                <h3 className="text-lg font-semibold text-slate-900 mb-4">Allocation</h3>
                                <div className="h-64">
                                    <AllocationChart holdings={portfolio.holdings} />
                                </div>
                                <div className="mt-6">
                                    <button
                                        onClick={handleOptimize}
                                        disabled={loading}
                                        className="w-full bg-indigo-600 border border-transparent rounded-lg shadow-sm py-2.5 px-4 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all duration-200"
                                    >
                                        {loading ? 'Running Optimization...' : 'Run Optimization'}
                                    </button>
                                    <p className="mt-2 text-xs text-center text-slate-500">
                                        Analyzes market data to suggest optimal weights.
                                    </p>
                                </div>
                            </div>

                            {/* Optimization Results (if available) */}
                            {optimizationResult && (
                                <div className="bg-white shadow-sm border border-slate-200 rounded-lg p-6 border-l-4 border-indigo-500 animate-in slide-in-from-right duration-300">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-lg font-semibold text-slate-900">Proposed Strategy</h3>
                                    </div>

                                    {/* AI Explanation Block */}
                                    <div className="mb-6 bg-indigo-50 rounded-md p-4">
                                        <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-2 flex items-center">
                                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                            AI Analysis
                                        </h4>
                                        {explanation ? (
                                            <p className="text-sm text-indigo-900 leading-relaxed">{explanation}</p>
                                        ) : (
                                            <div className="flex items-center space-x-2 text-sm text-indigo-700">
                                                <div className="animate-spin h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
                                                <span>Generating insights...</span>
                                            </div>
                                        )}
                                    </div>

                                    <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 mb-4">
                                        <div className="sm:col-span-1">
                                            <dt className="text-xs font-medium text-slate-500 uppercase">Return</dt>
                                            <dd className="mt-1 text-lg font-semibold text-green-600">
                                                {(optimizationResult.metrics.expected_return * 100).toFixed(2)}%
                                            </dd>
                                        </div>
                                        <div className="sm:col-span-1">
                                            <dt className="text-xs font-medium text-slate-500 uppercase">Risk</dt>
                                            <dd className="mt-1 text-lg font-semibold text-red-600">
                                                {(optimizationResult.metrics.volatility * 100).toFixed(2)}%
                                            </dd>
                                        </div>
                                        <div className="sm:col-span-2">
                                            <dt className="text-xs font-medium text-slate-500 uppercase">Sharpe Ratio</dt>
                                            <dd className="mt-1 text-lg font-semibold text-slate-900">
                                                {optimizationResult.metrics.sharpe_ratio.toFixed(2)}
                                            </dd>
                                        </div>
                                    </dl>

                                    <div className="border-t border-slate-200 pt-4">
                                        <h4 className="text-xs font-medium text-slate-500 uppercase mb-2">Allocation Changes</h4>
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-slate-200">
                                                <thead className="bg-slate-50">
                                                    <tr>
                                                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Ticker</th>
                                                        <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">Current</th>
                                                        <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">Target</th>
                                                        <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">Change</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-slate-200">
                                                    {Object.entries(optimizationResult.optimized_weights).map(([ticker, weight]: [string, any]) => {
                                                        const currentW = currentWeights[ticker] || 0;
                                                        const targetW = weight;
                                                        const delta = targetW - currentW;
                                                        const isSignificant = Math.abs(delta) > 0.001;

                                                        return (
                                                            <tr key={ticker} className={!isSignificant ? 'opacity-60' : ''}>
                                                                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-slate-900">{ticker}</td>
                                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-500 text-right">
                                                                    {(currentW * 100).toFixed(1)}%
                                                                </td>
                                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900 text-right font-medium">
                                                                    {(targetW * 100).toFixed(1)}%
                                                                </td>
                                                                <td className={`px-3 py-2 whitespace-nowrap text-sm text-right font-medium ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-slate-400'
                                                                    }`}>
                                                                    {delta > 0 ? '+' : ''}{(delta * 100).toFixed(1)}%
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div className="mt-6 flex space-x-3">
                                        <button
                                            onClick={handleAccept}
                                            disabled={logging || isOptimal}
                                            className={`flex-1 border border-transparent rounded-md shadow-sm py-2 px-4 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 transition-colors ${isOptimal ? 'bg-slate-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                                                }`}
                                        >
                                            {logging ? 'Applying...' : 'Accept'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setOptimizationResult(null);
                                                setExplanation(null);
                                            }}
                                            className="flex-1 bg-white border border-slate-300 rounded-md shadow-sm py-2 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                                        >
                                            Dismiss
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Add Stock Modal */}
                    {showAddModal && (
                        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                            <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full animate-in zoom-in-95 duration-200">
                                <h3 className="text-lg font-semibold text-slate-900 mb-4">Add New Holding</h3>
                                <form onSubmit={handleAddHolding} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700">Ticker Symbol</label>
                                        <input
                                            type="text"
                                            required
                                            className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            placeholder="e.g. AAPL"
                                            value={newHolding.ticker}
                                            onChange={(e) => setNewHolding({ ...newHolding, ticker: e.target.value.toUpperCase() })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700">Quantity</label>
                                            <input
                                                type="number"
                                                required
                                                step="any"
                                                className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                value={newHolding.quantity}
                                                onChange={(e) => setNewHolding({ ...newHolding, quantity: parseFloat(e.target.value) })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700">Avg Price</label>
                                            <input
                                                type="number"
                                                step="any"
                                                required
                                                className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                value={newHolding.avg_price}
                                                onChange={(e) => setNewHolding({ ...newHolding, avg_price: parseFloat(e.target.value) })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700">Currency</label>
                                        <select
                                            className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            value={newHolding.currency}
                                            onChange={(e) => setNewHolding({ ...newHolding, currency: e.target.value })}
                                        >
                                            <option value="USD">$ USD - US Dollar</option>
                                            <option value="EUR">€ EUR - Euro</option>
                                            <option value="INR">₹ INR - Indian Rupee</option>
                                        </select>
                                    </div>
                                    <div className="flex justify-end space-x-3 mt-6 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowAddModal(false)}
                                            className="bg-white py-2 px-4 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="bg-indigo-600 border border-transparent rounded-md shadow-sm py-2 px-4 inline-flex justify-center text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                                        >
                                            Add Holding
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default PortfolioDetails;
