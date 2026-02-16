import api from '../api/axios';

export interface Holding {
    ticker: string;
    quantity: number;
    avg_price: number;
    currency: string;  // USD, EUR, INR
    value_in_usd?: number;  // Converted value for normalized calculations
}

export interface Portfolio {
    id: number;
    name: string;
    currency: string;  // USD, EUR, INR
    holdings: Holding[];
    total_value_usd?: number;  // Total portfolio value in USD
}


export const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: '$',
    EUR: '€',
    INR: '₹'
};

export const getPortfolios = async () => {
    const response = await api.get<Portfolio[]>('/portfolios/');
    return response.data;
};

export const createPortfolio = async (name: string, holdings: Holding[], currency: string = 'USD') => {
    const response = await api.post<Portfolio>('/portfolios/', { name, holdings, currency });
    return response.data;
};

export const getPortfolio = async (id: number) => {
    const response = await api.get<Portfolio>(`/portfolios/${id}`);
    return response.data;
};

export interface OptimizationResult {
    id: number;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    explanation: string | null;
    created_at: string;
}

export const getOptimizationResult = async (id: number) => {
    const response = await api.get<OptimizationResult>(`/rebalance/optimizations/${id}`);
    return response.data;
};

export const optimizePortfolio = async (id: number) => {
    const response = await api.post(`/rebalance/${id}/optimize`);
    return response.data; // Returns { portfolio_id, optimization_id, optimized_weights, metrics }
};

export const logRebalance = async (data: { portfolio_id: number, old_weights: Record<string, number>, recommended_weights: Record<string, number>, reason?: string }) => {
    const response = await api.post('/rebalance/log', data);
    return response.data;
};

export const addHolding = async (portfolioId: number, holding: Omit<Holding, 'ticker' | 'quantity' | 'avg_price'> & { ticker: string, quantity: number, avg_price: number }) => {
    const response = await api.post<Portfolio>(`/portfolios/${portfolioId}/holdings`, holding);
    return response.data;
};

export const applyRebalance = async (portfolioId: number, targetWeights: Record<string, number>) => {
    const response = await api.post(`/rebalance/${portfolioId}/apply`, { target_weights: targetWeights });
    return response.data;
};

export interface PortfolioAnalytics {
    sharpe_ratio: number;
    sortino_ratio: number;
    max_drawdown: number;
    value_at_risk_95: number;
    volatility: number;
    volatility_history: { date: string; value: number }[];
}

export const getPortfolioAnalytics = async (id: number) => {
    const response = await api.get<PortfolioAnalytics>(`/portfolios/${id}/analytics`);
    return response.data;
};
