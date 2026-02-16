import React from 'react';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';

interface PortfolioHistoryChartProps {
    currentValue: number;
}

const PortfolioHistoryChart: React.FC<PortfolioHistoryChartProps> = ({ currentValue }) => {
    // Generate mock history data based on current value
    // Simulating a 6-month growth trend
    const data = React.useMemo(() => {
        const history = [];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
        let value = currentValue * 0.85; // Start at 85% of current value

        for (let i = 0; i < 6; i++) {
            // Add some random fluctuation but general upward trend to match current value at end
            const volatility = (Math.random() - 0.3) * 0.05; // -1.5% to +3.5%
            value = value * (1 + volatility);

            // Ensure the last point matches current value closely
            if (i === 5) value = currentValue;

            history.push({
                name: months[i],
                value: Number(value.toFixed(2))
            });
        }
        return history;
    }, [currentValue]);

    return (
        <div className="h-[300px] w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={data}
                    margin={{
                        top: 10,
                        right: 10,
                        left: 0,
                        bottom: 0,
                    }}
                >
                    <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1} />
                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 12 }}
                        dy={10}
                    />
                    <YAxis
                        hide={false}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 12 }}
                        tickFormatter={(value) => `$${value.toLocaleString()}`}
                        domain={['auto', 'auto']}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#fff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                        formatter={(value: any) => [`$${value.toLocaleString()}`, 'Portfolio Value']}
                    />
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#4f46e5"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorValue)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

export default PortfolioHistoryChart;
