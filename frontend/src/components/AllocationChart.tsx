import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { Holding } from '../services/portfolioService';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

interface AllocationChartProps {
    holdings: Holding[];
}

const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const { name, value, percent } = payload[0].payload;
    return (
        <div className="rounded-lg px-3 py-2 text-xs shadow-xl"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            <p className="font-semibold">{name}</p>
            <p style={{ color: 'var(--text-secondary)' }}>${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p style={{ color: 'var(--accent)' }}>{((percent ?? 0) * 100).toFixed(1)}%</p>
        </div>
    );
};

const AllocationChart: React.FC<AllocationChartProps> = ({ holdings }) => {
    const data = holdings.map(h => ({
        name: h.ticker,
        value: h.value_in_usd ?? h.quantity * h.avg_price,
    }));

    return (
        <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius="40%"
                    outerRadius="70%"
                    paddingAngle={3}
                    dataKey="value"
                >
                    {data.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />
                    ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
            </PieChart>
        </ResponsiveContainer>
    );
};

export default AllocationChart;
