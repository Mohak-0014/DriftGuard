import React, { useState, useEffect, useRef } from 'react';
import { searchTickers } from '../services/marketService';

interface TickerSearchProps {
    onSelect: (ticker: string) => void;
    placeholder?: string;
    className?: string;
}

const TickerSearch: React.FC<TickerSearchProps> = ({ onSelect, placeholder = 'Search ticker…', className }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        if (query.length < 2) { setResults([]); setOpen(false); return; }
        const t = setTimeout(async () => {
            setLoading(true);
            try {
                const data = await searchTickers(query);
                setResults(data);
                setOpen(data.length > 0);
            } catch { setResults([]); }
            finally { setLoading(false); }
        }, 400);
        return () => clearTimeout(t);
    }, [query]);

    const handleSelect = (symbol: string) => {
        setQuery(symbol);
        setOpen(false);
        onSelect(symbol);
    };

    return (
        <div className={`relative ${className ?? ''}`} ref={ref}>
            <div className="relative">
                <input
                    type="text"
                    placeholder={placeholder}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onFocus={() => results.length > 0 && setOpen(true)}
                    className="w-full px-3 py-2 text-sm pr-8"
                />
                {loading && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                        <span className="w-3.5 h-3.5 border-2 rounded-full animate-spin block"
                            style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
                    </div>
                )}
            </div>

            {open && results.length > 0 && (
                <ul className="absolute z-30 mt-1 w-full rounded-xl overflow-hidden shadow-2xl"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    {results.slice(0, 8).map((r, i) => (
                        <li
                            key={i}
                            onClick={() => handleSelect(r.symbol)}
                            className="flex items-center justify-between px-3 py-2 cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                        >
                            <div>
                                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                    {r.symbol}
                                </span>
                                <span className="text-xs ml-2 truncate max-w-[140px] inline-block align-middle"
                                    style={{ color: 'var(--text-muted)' }}>
                                    {r.shortname || r.longname}
                                </span>
                            </div>
                            <span className="text-xs flex-shrink-0 ml-2"
                                style={{ color: 'var(--text-muted)' }}>
                                {r.exchange}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default TickerSearch;
