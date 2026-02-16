import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Holding } from '../services/portfolioService';

interface AllocationChartProps {
    holdings: Holding[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const AllocationChart: React.FC<AllocationChartProps> = ({ holdings }) => {
    // Determine value for chart using converted USD value if available
    const data = holdings.map(h => ({
        name: h.ticker,
        value: h.value_in_usd ?? (h.quantity * h.avg_price),
    }));

    return (
        <div className="w-full h-64 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    >
                        {data.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Value']} />
                    <Legend />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
};

export default AllocationChart;
