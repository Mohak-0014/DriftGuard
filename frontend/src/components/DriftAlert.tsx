import React from 'react';

interface DriftAlertProps {
    currentWeights: Record<string, number>;
    targetWeights: Record<string, number>;
    threshold?: number; // e.g., 0.05 for 5%
}

const DriftAlert: React.FC<DriftAlertProps> = ({ currentWeights, targetWeights, threshold = 0.05 }) => {
    const drifts: { ticker: string; diff: number }[] = [];

    // Check drift for each asset in target
    Object.keys(targetWeights).forEach(ticker => {
        const target = targetWeights[ticker] || 0;
        const current = currentWeights[ticker] || 0;
        const diff = current - target;

        if (Math.abs(diff) > threshold) {
            drifts.push({ ticker, diff });
        }
    });

    // Also check assets in current but not in target (should be 0%)
    Object.keys(currentWeights).forEach(ticker => {
        if (!targetWeights[ticker] && currentWeights[ticker] > threshold) {
            drifts.push({ ticker, diff: currentWeights[ticker] });
        }
    });

    if (drifts.length === 0) return null;

    return (
        <div className="rounded-md bg-yellow-50 p-4 mb-6">
            <div className="flex">
                <div className="flex-shrink-0">
                    {/* Heroicon name: solid/exclamation */}
                    <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                </div>
                <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">Portfolio Drift Detected</h3>
                    <div className="mt-2 text-sm text-yellow-700">
                        <ul className="list-disc pl-5 space-y-1">
                            {drifts.map(d => (
                                <li key={d.ticker}>
                                    {d.ticker}: {Math.abs(d.diff * 100).toFixed(1)}% {d.diff > 0 ? 'Overweight' : 'Underweight'}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DriftAlert;
