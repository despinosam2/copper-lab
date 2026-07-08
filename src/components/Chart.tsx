import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Area
} from 'recharts';

interface ChartProps {
  data: any[];
  lines: {
    key: string;
    name: string;
    color: string;
    strokeWidth?: number;
    strokeDasharray?: string;
  }[];
  area?: {
    keyLower: string;
    keyUpper: string;
    color: string;
    name: string;
  };
}

export function Chart({ data, lines, area }: ChartProps) {
  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          {/* El ancho del eje Y se adapta a etiquetas de 3 dígitos (datos reales en ¢/lb) */}
          <CartesianGrid strokeDasharray="3 3" stroke="#28313b" vertical={false} />
          <XAxis 
            dataKey="date" 
            stroke="#78838d" 
            tick={{ fill: '#78838d', fontSize: 12, fontFamily: 'IBM Plex Mono' }}
            tickMargin={10}
            minTickGap={30}
          />
          <YAxis
            stroke="#78838d"
            tick={{ fill: '#78838d', fontSize: 12, fontFamily: 'IBM Plex Mono' }}
            domain={['auto', 'auto']}
            tickFormatter={(val) => val.toFixed(1)}
            width={55}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#171c22', border: '1px solid #28313b', borderRadius: '3px', color: '#e8ecef', fontFamily: 'IBM Plex Mono' }}
            itemStyle={{ fontFamily: 'IBM Plex Mono' }}
            formatter={(value: any) => {
              if (typeof value === 'number') {
                return value.toFixed(3);
              }
              return value;
            }}
          />
          
          {area && (
            // Área de rango nativa de Recharts: dataKey devuelve [inferior, superior]
            <Area
              type="monotone"
              dataKey={(d: any) =>
                d[area.keyLower] != null && d[area.keyUpper] != null
                  ? [d[area.keyLower], d[area.keyUpper]]
                  : null
              }
              stroke="none"
              fill={area.color}
              fillOpacity={0.18}
              name={area.name}
              activeDot={false}
              isAnimationActive={false}
            />
          )}
          
          {lines.map(line => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.name}
              stroke={line.color}
              strokeWidth={line.strokeWidth || 2}
              strokeDasharray={line.strokeDasharray}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
