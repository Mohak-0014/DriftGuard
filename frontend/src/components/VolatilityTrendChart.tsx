import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface VolatilityTrendChartProps {
    data: { date: string; value: number }[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg px-3 py-2 text-xs shadow-xl"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            <p style={{ color: 'var(--text-muted)' }}>{label}</p>
            <p className="font-semibold mt-0.5" style={{ color: '#f59e0b' }}>
                {payload[0].value?.toFixed(2)}% vol
            </p>
        </div>
    );
};

const VolatilityTrendChart: React.FC<VolatilityTrendChartProps> = ({ data }) => {
    if (!data || data.length === 0) return (
        <div className="h-full flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
            No volatility history available.
        </div>
    );

    const chartData = data.map(d => ({
        dateFormatted: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        valuePercent: +(d.value * 100).toFixed(2),
    }));

    return (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis
                    dataKey="dateFormatted"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    dy={8}
                    minTickGap={40}
                />
                <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    tickFormatter={v => `${v.toFixed(0)}%`}
                    domain={['auto', 'auto']}
                    width={36}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                    type="monotone"
                    dataKey="valuePercent"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fill="url(#volGrad)"
                />
            </AreaChart>
        </ResponsiveContainer>
    );
};

export default VolatilityTrendChart;
