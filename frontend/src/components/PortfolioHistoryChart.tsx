import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PortfolioHistoryChartProps { currentValue: number; }

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg px-3 py-2 text-xs shadow-xl"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            <p style={{ color: 'var(--text-muted)' }}>{label}</p>
            <p className="font-semibold mt-0.5" style={{ color: 'var(--accent)' }}>
                ${Number(payload[0].value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
        </div>
    );
};

const PortfolioHistoryChart: React.FC<PortfolioHistoryChartProps> = ({ currentValue }) => {
    const data = React.useMemo(() => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
        let v = currentValue * 0.82;
        return months.map((name, i) => {
            v = v * (1 + (Math.random() - 0.25) * 0.06);
            if (i === months.length - 1) v = currentValue;
            return { name, value: +v.toFixed(2) };
        });
    }, [currentValue]);

    return (
        <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="valueGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                        dy={8}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                        tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                        domain={['auto', 'auto']}
                        width={40}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#6366f1"
                        strokeWidth={2}
                        fill="url(#valueGrad)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

export default PortfolioHistoryChart;
