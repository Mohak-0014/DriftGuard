import React from 'react';

interface DriftAlertProps {
    currentWeights: Record<string, number>;
    targetWeights: Record<string, number>;
    threshold?: number;
}

const DriftAlert: React.FC<DriftAlertProps> = ({ currentWeights, targetWeights, threshold = 0.05 }) => {
    const drifts: { ticker: string; diff: number }[] = [];

    Object.keys(targetWeights).forEach(ticker => {
        const diff = (currentWeights[ticker] ?? 0) - (targetWeights[ticker] ?? 0);
        if (Math.abs(diff) > threshold) drifts.push({ ticker, diff });
    });

    Object.keys(currentWeights).forEach(ticker => {
        if (!targetWeights[ticker] && currentWeights[ticker] > threshold)
            drifts.push({ ticker, diff: currentWeights[ticker] });
    });

    if (drifts.length === 0) return null;

    return (
        <div className="rounded-xl px-4 py-3 flex gap-3 items-start"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#f59e0b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
                <p className="text-xs font-semibold mb-1" style={{ color: '#fbbf24' }}>Drift detected vs. proposed allocation</p>
                <div className="flex flex-wrap gap-2">
                    {drifts.map(d => (
                        <span key={d.ticker} className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(245,158,11,0.15)', color: '#fde68a' }}>
                            {d.ticker}: {Math.abs(d.diff * 100).toFixed(1)}% {d.diff > 0 ? '↑ over' : '↓ under'}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default DriftAlert;
