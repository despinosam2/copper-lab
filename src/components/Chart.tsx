import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Area,
  ReferenceLine
} from 'recharts';

/** Redondea a 2 decimales; formatea rangos [lower, upper] como "142.38 – 198.29". */
function formatTooltipValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(v => (typeof v === 'number' ? v.toFixed(2) : v)).join(' – ');
  }
  return typeof value === 'number' ? value.toFixed(2) : String(value);
}

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
  /** Valor del eje X donde dibujar una línea vertical (p. ej. corte train/test). */
  referenceX?: string;
  /** R21 (C4d): descripción para lectores de pantalla — los SVG de Recharts no exponen texto por sí solos. */
  ariaLabel?: string;
}

export function Chart({ data, lines, area, referenceX, ariaLabel }: ChartProps) {
  return (
    <div
      className="w-full h-80"
      role="img"
      aria-label={ariaLabel ?? `Gráfico de líneas: ${lines.map(l => l.name).join(', ')}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          {/* El ancho del eje Y se adapta a etiquetas de 3 dígitos (datos reales en ¢/lb) */}
          <CartesianGrid strokeDasharray="3 3" stroke="#28313b" vertical={false} />
          <XAxis 
            dataKey="date" 
            stroke="#7d8892" 
            tick={{ fill: '#7d8892', fontSize: 12, fontFamily: 'IBM Plex Mono' }}
            tickMargin={10}
            minTickGap={30}
          />
          <YAxis
            stroke="#7d8892"
            tick={{ fill: '#7d8892', fontSize: 12, fontFamily: 'IBM Plex Mono' }}
            domain={['auto', 'auto']}
            tickFormatter={(val) => val.toFixed(1)}
            width={55}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#171c22',
              border: '1px solid #28313b',
              borderRadius: '3px',
              color: '#e8ecef',
              fontFamily: 'IBM Plex Mono',
              fontSize: 12,
              padding: '8px 10px'
            }}
            labelStyle={{ color: '#e8ecef', marginBottom: 4 }}
            itemStyle={{ fontFamily: 'IBM Plex Mono', padding: 0 }}
            // Sin esto, valores sin redondear (o el rango [lower, upper] de la
            // banda de incertidumbre) podían salir con muchos decimales y
            // ensanchar el recuadro hasta tapar buena parte del gráfico.
            formatter={(value: unknown, name: string) => [formatTooltipValue(value), name]}
          />
          <Legend
            wrapperStyle={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: '#aab4bd', paddingTop: 8 }}
            iconType="plainline"
          />

          {referenceX && (
            <ReferenceLine x={referenceX} stroke="#79d4c2" strokeDasharray="4 4" />
          )}

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
