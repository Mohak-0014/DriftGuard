import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortfolio, type Holding } from '../services/portfolioService';

const CURRENCIES = [
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee' }
];

const Onboarding: React.FC = () => {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [holdings, setHoldings] = useState<Holding[]>([
        { ticker: '', quantity: 0, avg_price: 0, currency: 'USD' }
    ]);
    const [error, setError] = useState('');

    const handleHoldingChange = (index: number, field: keyof Holding, value: string | number) => {
        const newHoldings = [...holdings];
        if (field === 'ticker' || field === 'currency') {
            newHoldings[index][field] = value as string;
        } else {
            newHoldings[index][field] = Number(value) as never;
        }
        setHoldings(newHoldings);
    };

    const addHolding = () => {
        setHoldings([...holdings, { ticker: '', quantity: 0, avg_price: 0, currency: 'USD' }]);
    };

    const removeHolding = (index: number) => {
        const newHoldings = holdings.filter((_, i) => i !== index);
        setHoldings(newHoldings);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Basic validation
        if (!name.trim()) {
            setError('Portfolio name is required');
            return;
        }

        const validHoldings = holdings.filter(h => h.ticker.trim() !== '' && h.quantity > 0);

        if (validHoldings.length === 0) {
            setError('Please add at least one valid holding (Ticker and Quantity > 0)');
            return;
        }

        try {
            await createPortfolio(name, validHoldings);
            navigate('/');
        } catch (err) {
            console.error('Failed to create portfolio', err);
            setError('Failed to create portfolio. Please try again.');
        }
    };

    return (
        <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8 animate-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Create Your Portfolio</h1>
                <p className="mt-2 text-lg text-slate-600">Enter your initial holdings to get started with optimization.</p>
            </div>

            <div className="bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden">
                <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8">
                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="border-b border-slate-200 pb-8">
                        <label htmlFor="name" className="block text-sm font-semibold text-slate-900 mb-1">
                            Portfolio Name
                        </label>
                        <input
                            type="text"
                            name="name"
                            id="name"
                            className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3"
                            placeholder="e.g. Retirement Fund 2050"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <label className="block text-lg font-medium text-slate-900">Holdings</label>
                            <button
                                type="button"
                                onClick={addHolding}
                                className="inline-flex items-center px-3 py-1.5 border border-slate-300 shadow-sm text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none"
                            >
                                + Add Row
                            </button>
                        </div>

                        <div className="space-y-4">
                            {holdings.map((holding, index) => (
                                <div key={index} className="flex flex-col sm:flex-row gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200 relative group transition-colors hover:border-slate-300">
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Ticker</label>
                                        <input
                                            type="text"
                                            value={holding.ticker}
                                            onChange={(e) => handleHoldingChange(index, 'ticker', e.target.value)}
                                            className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                            placeholder="AAPL"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Quantity</label>
                                        <input
                                            type="number"
                                            value={holding.quantity}
                                            onChange={(e) => handleHoldingChange(index, 'quantity', e.target.value)}
                                            className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                            min="0"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Avg Price</label>
                                        <input
                                            type="number"
                                            value={holding.avg_price}
                                            onChange={(e) => handleHoldingChange(index, 'avg_price', e.target.value)}
                                            className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                    <div className="w-full sm:w-28">
                                        <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Currency</label>
                                        <select
                                            value={holding.currency}
                                            onChange={(e) => handleHoldingChange(index, 'currency', e.target.value)}
                                            className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-white"
                                        >
                                            {CURRENCIES.map((c) => (
                                                <option key={c.code} value={c.code}>
                                                    {c.symbol} {c.code}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex items-end pb-0.5">
                                        <button
                                            type="button"
                                            onClick={() => removeHolding(index)}
                                            className="text-slate-400 hover:text-red-600 transition-colors p-2"
                                            title="Remove holding"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end items-center space-x-4">
                        <button
                            type="button"
                            onClick={() => navigate('/')}
                            className="px-4 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-bold rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform transform hover:scale-105"
                        >
                            Create Portfolio
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Onboarding;
