import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

// Electric-blue-anchored palette matching the new dark theme
const PALETTE = [
  '#4f8ef7', '#00d4aa', '#a78bfa', '#38bdf8', '#fb923c',
  '#f472b6', '#84cc16', '#facc15', '#ff4d6a', '#2dd4bf',
]

const TOOLTIP_STYLE = {
  background: '#0d1117',
  border: '1px solid #1e2530',
  borderRadius: 6,
  fontSize: 11,
  fontFamily: '"JetBrains Mono", monospace',
}

interface Props {
  weights: Record<string, number>
}

export function WeightsChart({ weights }: Props) {
  const data = Object.entries(weights)
    .filter(([, v]) => v > 0.0005)
    .map(([name, value]) => ({ name, value: Math.round(value * 10000) / 100 }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="bg-card rounded-panel p-4 border border-border">
      <p className="text-[10px] text-muted font-mono uppercase tracking-widest mb-3">
        Optimal Weights
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={108}
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: number) => [`${v.toFixed(2)}%`, 'Weight']}
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: '#e8eaf0' }}
          />
          <Legend
            iconType="circle"
            iconSize={7}
            formatter={(v: string) => (
              <span style={{ color: '#8892a4', fontSize: 11, fontFamily: '"JetBrains Mono", monospace' }}>
                {v}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
