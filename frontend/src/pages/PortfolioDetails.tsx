import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPortfolio, optimizePortfolio, addHolding, applyRebalance, getOptimizationResult, CURRENCY_SYMBOLS, updateHolding, deleteHolding } from '../services/portfolioService';
import type { Portfolio } from '../services/portfolioService';
import { getLatestPrices, updatePrices, getSentiment } from '../services/marketService';
import type { SentimentData } from '../services/marketService';
import SentimentIndicator from '../components/SentimentIndicator';
import AllocationChart from '../components/AllocationChart';
import DriftAlert from '../components/DriftAlert';
import PortfolioHistoryChart from '../components/PortfolioHistoryChart';
import AnalyticsTab from '../components/AnalyticsTab';
import TickerSearch from '../components/TickerSearch';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline'; // Assuming you have heroicons or use text

const PortfolioDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
    const [optimizationResult, setOptimizationResult] = useState<any>(null);
    const [explanation, setExplanation] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [logging, setLogging] = useState(false); // State for logging action
    const [prices, setPrices] = useState<Record<string, number>>({});
    const [sentimentData, setSentimentData] = useState<Record<string, SentimentData>>({});
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [holdingForm, setHoldingForm] = useState({ ticker: '', quantity: 0, avg_price: 0, currency: 'USD' });
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
                updatePrices(tickers).then(() => {
                    fetchPrices(tickers);
                }).catch(err => console.error("Update failed", err));
                fetchPrices(tickers);
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

    const handleOpenAdd = () => {
        setIsEditing(false);
        setHoldingForm({ ticker: '', quantity: 0, avg_price: 0, currency: 'USD' });
        setShowModal(true);
    };

    const handleOpenEdit = (holding: any) => {
        setIsEditing(true);
        setHoldingForm({
            ticker: holding.ticker,
            quantity: holding.quantity,
            avg_price: holding.avg_price,
            currency: holding.currency
        });
        setShowModal(true);
    };

    const handleDelete = async (ticker: string) => {
        if (!id || !confirm(`Are you sure you want to remove ${ticker}?`)) return;
        try {
            await deleteHolding(parseInt(id), ticker);
            loadPortfolio(parseInt(id));
        } catch (error) {
            console.error("Failed to delete holding", error);
            alert("Failed to delete holding.");
        }
    };

    const handleSubmitHolding = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        try {
            if (isEditing) {
                await updateHolding(parseInt(id), holdingForm.ticker, holdingForm);
            } else {
                await addHolding(parseInt(id), holdingForm);
            }
            setShowModal(false);
            loadPortfolio(parseInt(id));
        } catch (error) {
            console.error("Failed to save holding", error);
            alert("Failed to save holding.");
        }
    };

    const handleOptimize = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const result = await optimizePortfolio(parseInt(id));
            setOptimizationResult(result);
            setExplanation(null);
        } catch (error) {
            console.error("Optimization failed", error);
            alert("Optimization failed. Ensure market data is available.");
        } finally {
            setLoading(false);
        }
    };

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
            await applyRebalance(parseInt(id), optimizationResult.optimized_weights);
            alert("Portfolio rebalanced successfully! Holdings have been updated.");
            setOptimizationResult(null);
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

    const currentWeights = calculateCurrentWeights();
    const displayTotalValue = portfolio.total_value_usd || 0;

    const isOptimal = optimizationResult && (() => {
        const targetWeights = optimizationResult.optimized_weights;
        const tickers = new Set([...Object.keys(currentWeights), ...Object.keys(targetWeights)]);
        let maxDeviation = 0;
        tickers.forEach(ticker => {
            const current = currentWeights[ticker] || 0;
            const target = targetWeights[ticker] || 0;
            maxDeviation = Math.max(maxDeviation, Math.abs(current - target));
        });
        return maxDeviation < 0.01;
    })();

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
                                        onClick={handleOpenAdd}
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
                                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Value</th>
                                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
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
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                                            <div className="flex justify-end space-x-2">
                                                                <button
                                                                    onClick={() => handleOpenEdit(holding)}
                                                                    className="text-indigo-600 hover:text-indigo-900 p-1 rounded-full hover:bg-indigo-50 transition-colors"
                                                                    title="Edit"
                                                                >
                                                                    <PencilIcon className="h-5 w-5" aria-hidden="true" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDelete(holding.ticker)}
                                                                    className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50 transition-colors"
                                                                    title="Delete"
                                                                >
                                                                    <TrashIcon className="h-5 w-5" aria-hidden="true" />
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

                    {/* Add/Edit Stock Modal */}
                    {showModal && (
                        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                            <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full animate-in zoom-in-95 duration-200">
                                <h3 className="text-lg font-semibold text-slate-900 mb-4">{isEditing ? 'Edit Holding' : 'Add New Holding'}</h3>
                                <form onSubmit={handleSubmitHolding} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700">Ticker Symbol</label>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                disabled
                                                className="mt-1 block w-full border-slate-300 rounded-md shadow-sm bg-slate-100 text-slate-500 sm:text-sm"
                                                value={holdingForm.ticker}
                                            />
                                        ) : (
                                            <TickerSearch
                                                onSelect={(ticker) => setHoldingForm({ ...holdingForm, ticker })}
                                                placeholder="Search e.g. AAPL"
                                                className="mt-1"
                                            />
                                        )}
                                    </div>
                                    {/* Hidden input to ensure state is bound if TickerSearch doesn't fully drive it or for fallback */}
                                    {!isEditing && holdingForm.ticker && (
                                        <p className="text-xs text-indigo-600">Selected: {holdingForm.ticker}</p>
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700">Quantity</label>
                                            <input
                                                type="number"
                                                required
                                                step="any"
                                                className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                value={holdingForm.quantity}
                                                onChange={(e) => setHoldingForm({ ...holdingForm, quantity: parseFloat(e.target.value) })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700">Avg Price</label>
                                            <input
                                                type="number"
                                                step="any"
                                                required
                                                className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                value={holdingForm.avg_price}
                                                onChange={(e) => setHoldingForm({ ...holdingForm, avg_price: parseFloat(e.target.value) })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700">Currency</label>
                                        <select
                                            className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            value={holdingForm.currency}
                                            onChange={(e) => setHoldingForm({ ...holdingForm, currency: e.target.value })}
                                        >
                                            <option value="USD">$ USD - US Dollar</option>
                                            <option value="EUR">€ EUR - Euro</option>
                                            <option value="INR">₹ INR - Indian Rupee</option>
                                        </select>
                                    </div>
                                    <div className="flex justify-end space-x-3 mt-6 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowModal(false)}
                                            className="bg-white py-2 px-4 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="bg-indigo-600 border border-transparent rounded-md shadow-sm py-2 px-4 inline-flex justify-center text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                                        >
                                            {isEditing ? 'Save Changes' : 'Add Holding'}
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
