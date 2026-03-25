import React, { useState, useEffect, useRef } from 'react';
import { searchTickers } from '../services/marketService';

interface TickerSearchProps {
    onSelect: (ticker: string) => void;
    placeholder?: string;
    className?: string;
}

const TickerSearch: React.FC<TickerSearchProps> = ({ onSelect, placeholder = "Search ticker...", className }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (query.length > 1) {
                setLoading(true);
                try {
                    const data = await searchTickers(query);
                    setResults(data);
                    setShowResults(true);
                } catch (error) {
                    console.error("Search failed", error);
                    setResults([]);
                } finally {
                    setLoading(false);
                }
            } else {
                setResults([]);
                setShowResults(false);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [query]);

    const handleSelect = (ticker: string) => {
        setQuery(ticker);
        setShowResults(false);
        onSelect(ticker);
    };

    return (
        <div className={`relative ${className}`} ref={searchRef}>
            <input
                type="text"
                className="block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder={placeholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
            {loading && (
                <div className="absolute right-3 top-2.5">
                    <div className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
                </div>
            )}

            {showResults && results.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                    {results.map((result, index) => (
                        <li
                            key={index}
                            className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-indigo-600 hover:text-white group"
                            onClick={() => handleSelect(result.symbol)}
                        >
                            <div className="flex justify-between">
                                <span className="font-medium truncate">{result.symbol}</span>
                                <span className="text-slate-500 group-hover:text-indigo-200 text-xs truncate ml-2">{result.shortname || result.longname}</span>
                            </div>
                            <span className="text-xs text-slate-400 group-hover:text-indigo-300 block">{result.exchange} - {result.type}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default TickerSearch;
