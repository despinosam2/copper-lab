import { downloadCsv } from './exportCsv';

// R18: botón compartido de descarga CSV — un solo estilo para las 7 vistas.
export function DownloadCsvButton({ rows, filename, label = 'Descargar CSV' }: {
  rows: Record<string, unknown>[];
  filename: string;
  label?: string;
}) {
  return (
    <button
      onClick={() => downloadCsv(rows, filename)}
      disabled={rows.length === 0}
      className="self-start px-3 py-1.5 text-xs font-medium font-body bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-ink-100 rounded-[3px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-patina"
    >
      {label}
    </button>
  );
}
