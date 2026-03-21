import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const PALETTE = [
  '#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#84cc16', '#f97316', '#14b8a6',
]

interface Props {
  weights: Record<string, number>
}

export function WeightsChart({ weights }: Props) {
  const data = Object.entries(weights)
    .filter(([, v]) => v > 0.0005)
    .map(([name, value]) => ({ name, value: Math.round(value * 10000) / 100 }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="bg-card rounded-2xl p-5 border border-border">
      <h3 className="text-sm font-semibold text-white mb-1">Optimal Weights</h3>
      <p className="text-xs text-muted mb-3">Portfolio allocation</p>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={72}
            outerRadius={110}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: number) => [`${v.toFixed(2)}%`, 'Weight']}
            contentStyle={{
              background: '#1a1d27',
              border: '1px solid #2a2d3a',
              borderRadius: 10,
              fontSize: 12,
            }}
            labelStyle={{ color: '#fff' }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(v: string) => (
              <span style={{ color: '#8b8fa8', fontSize: 12 }}>{v}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
