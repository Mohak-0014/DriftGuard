import React from 'react';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Area,
    AreaChart
} from 'recharts';

interface VolatilityTrendChartProps {
    data: { date: string; value: number }[];
}

const VolatilityTrendChart: React.FC<VolatilityTrendChartProps> = ({ data }) => {
    // Format data for chart (convert value to percentage if needed, though usually kept as decimal for logic, display as %)
    const chartData = data.map(d => ({
        ...d,
        dateFormatted: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        valuePercent: d.value * 100
    }));

    if (!data || data.length === 0) {
        return (
            <div className="flex justify-center items-center h-full text-slate-400 text-sm">
                No volatility history available.
            </div>
        );
    }

    return (
        <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={chartData}
                    margin={{
                        top: 10,
                        right: 10,
                        left: 0,
                        bottom: 0,
                    }}
                >
                    <defs>
                        <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1} />
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                        dataKey="dateFormatted"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 12 }}
                        dy={10}
                        minTickGap={30}
                    />
                    <YAxis
                        hide={false}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 12 }}
                        tickFormatter={(value) => `${value.toFixed(1)}%`}
                        domain={['auto', 'auto']}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#fff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                        formatter={(value: number | undefined) => [`${value?.toFixed(2)}%`, 'Volatility (Annualized)']}
                        labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Area
                        type="monotone"
                        dataKey="valuePercent"
                        stroke="#f59e0b" // Amber/Orange for Caution/Risk
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorVol)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

export default VolatilityTrendChart;
