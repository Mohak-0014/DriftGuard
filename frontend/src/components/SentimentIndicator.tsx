import React from 'react';

interface SentimentIndicatorProps {
    score: number | null;
    articleCount?: number;
    subjectivity?: number;
    loading?: boolean;
}

const SentimentIndicator: React.FC<SentimentIndicatorProps> = ({ score, articleCount, subjectivity, loading }) => {
    if (loading) {
        return <span className="animate-pulse bg-gray-300 h-4 w-12 rounded inline-block"></span>;
    }

    if (score === null || score === undefined) {
        return <span className="text-gray-400 text-xs">-</span>;
    }

    let color = "text-gray-500";
    let icon = "😐";
    let label = "Neutral";

    if (score > 0.1) {
        color = "text-green-600 font-medium";
        icon = "🚀"; // or 📈
        label = "Bullish";
    } else if (score < -0.1) {
        color = "text-red-600 font-medium";
        icon = "🐻"; // or 📉
        label = "Bearish";
    }

    return (
        <div className="flex items-center space-x-1 group relative cursor-help">
            <span className="text-lg">{icon}</span>
            <span className={`text-sm ${color}`}>{score.toFixed(2)}</span>

            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded py-1 px-2 w-32 z-10 shadow-lg">
                <p>{label}</p>
                <p>Articles: {articleCount || 0}</p>
                {subjectivity !== undefined && <p>Subj: {subjectivity.toFixed(2)}</p>}
            </div>
        </div>
    );
};

export default SentimentIndicator;
