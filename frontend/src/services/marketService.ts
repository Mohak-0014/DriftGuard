import api from '../api/axios';

export const getLatestPrices = async (tickers: string[]) => {
    if (tickers.length === 0) return {};
    const response = await api.get<Record<string, number>>(`/market/latest?tickers=${tickers.join(',')}`);
    return response.data;
};

export const updatePrices = async (tickers: string[]) => {
    if (tickers.length === 0) return;
    await api.post('/market/update', { tickers });
};

export interface SentimentData {
    score: number;
    subjectivity: number;
    article_count: number;
    source: string;
}

export const getSentiment = async (ticker: string): Promise<SentimentData> => {
    const response = await api.get(`/market/sentiment/${ticker}`);
    return response.data;
};

export interface VolatilityPoint {
    date: string;
    value: number;
}

export const getVolatilityHistory = async (ticker: string) => {
    const response = await api.get(`/market/volatility/${ticker}`);
    return response.data;
};

export const searchTickers = async (query: string) => {
    const response = await api.get(`/market/search?q=${query}`);
    return response.data;
};
