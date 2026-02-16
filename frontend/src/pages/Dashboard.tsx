import React, { useEffect, useState } from 'react';
import { getPortfolios, type Portfolio } from '../services/portfolioService';
import { Link } from 'react-router-dom';

const Dashboard: React.FC = () => {
    const [portfolios, setPortfolios] = useState<Portfolio[]>([]);

    useEffect(() => {
        loadPortfolios();
    }, []);

    const loadPortfolios = async () => {
        try {
            const data = await getPortfolios();
            setPortfolios(data);
        } catch (error) {
            console.error("Failed to load portfolios", error);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center sm:px-0">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
                <Link
                    to="/onboarding"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                >
                    + Create Portfolio
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {portfolios.map((portfolio) => (
                    <Link
                        key={portfolio.id}
                        to={`/portfolio/${portfolio.id}`}
                        className="block group"
                    >
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-all duration-200 hover:border-indigo-300">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{portfolio.name}</h2>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Last updated: Today
                                    </p>
                                </div>
                                <div className="h-10 w-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                    </svg>
                                </div>
                            </div>

                            <div className="mt-6">
                                <div className="flex justify-between items-end border-t border-slate-100 pt-4">
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Value</p>
                                        <p className="mt-1 text-2xl font-bold text-slate-900">
                                            {portfolio.total_value_usd ? `$${portfolio.total_value_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00'}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Holdings</p>
                                        <p className="mt-1 text-lg font-semibold text-slate-700">{portfolio.holdings.length}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>

            {portfolios.length === 0 && (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                    <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-slate-900">No portfolios</h3>
                    <p className="mt-1 text-sm text-slate-500">Get started by creating a new portfolio.</p>
                    <div className="mt-6">
                        <Link
                            to="/onboarding"
                            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            Create Portfolio
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
