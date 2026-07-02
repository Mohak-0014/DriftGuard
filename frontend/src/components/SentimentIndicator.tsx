import React from 'react';

interface SentimentIndicatorProps {
    score: number | null;
    articleCount?: number;
    subjectivity?: number;
    loading?: boolean;
}

const SentimentIndicator: React.FC<SentimentIndicatorProps> = ({ score, articleCount, subjectivity, loading }) => {
    if (loading) return <div className="skeleton h-4 w-14 rounded-full" />;
    if (score === null || score === undefined) return <span style={{ color: 'var(--text-muted)' }}>—</span>;

    const isBullish = score > 0.1;
    const isBearish = score < -0.1;

    const badgeClass = isBullish ? 'badge-green' : isBearish ? 'badge-red' : '';
    const label = isBullish ? 'Bullish' : isBearish ? 'Bearish' : 'Neutral';
    const labelColor = isBullish ? 'var(--green)' : isBearish ? 'var(--red)' : 'var(--text-muted)';

    return (
        <div className="group relative inline-flex items-center gap-1.5 cursor-help">
            <span className={`badge ${badgeClass}`} style={!isBullish && !isBearish ? { background: 'var(--bg-hover)', color: 'var(--text-muted)' } : undefined}>
                {label}
            </span>
            <span className="text-xs font-mono" style={{ color: labelColor }}>
                {score > 0 ? '+' : ''}{score.toFixed(2)}
            </span>

            {/* Tooltip */}
            <div className="pointer-events-none absolute bottom-full left-0 mb-2 hidden group-hover:block z-20 w-36 rounded-lg p-2 text-xs shadow-xl"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{label}</p>
                <p>Score: {score.toFixed(3)}</p>
                {articleCount !== undefined && <p>Articles: {articleCount}</p>}
                {subjectivity !== undefined && <p>Subjectivity: {subjectivity.toFixed(2)}</p>}
            </div>
        </div>
    );
};

export default SentimentIndicator;
