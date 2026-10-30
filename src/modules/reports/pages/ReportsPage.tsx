import { useState, useEffect, useMemo } from 'react';
import { BarChart3, Download, FileText, Search, X } from 'lucide-react';
import { FaFilePdf } from 'react-icons/fa6';
import { RiFileExcel2Fill } from 'react-icons/ri';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../../../shared/services/supabase';
import { useNotify } from '../../../shared/hooks/useNotify';
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner';
import Loader from '../../../shared/components/ui/Loader';

type ReportSource = 'assets' | 'tickets' | 'maintenance' | 'spare_parts' | 'cameras' | 'servers' | 'vehiculos';

interface ReportData {
  label: string;
  count: number;
  details: Record<string, number>;
  rawData: any[];
}

const SOURCE_CONFIG: Record<ReportSource, { label: string; table: string; titleField: string; statusField: string }> = {
  assets: { label: 'Activos', table: 'assets', titleField: 'name', statusField: 'status' },
  tickets: { label: 'Tickets', table: 'tickets', titleField: 'title', statusField: 'status' },
  maintenance: { label: 'Mantenimiento', table: 'maintenance_records', titleField: 'description', statusField: 'status' },
  spare_parts: { label: 'Repuestos', table: 'spare_parts', titleField: 'name', statusField: 'category' },
  cameras: { label: 'Cámaras', table: 'cameras', titleField: 'name', statusField: 'status' },
  servers: { label: 'Servidores', table: 'servers', titleField: 'name', statusField: 'status' },
  vehiculos: { label: 'Vehículos', table: 'vehiculos', titleField: 'placa', statusField: 'estado' },
};

export default function ReportsPage() {
  const { success: notifySuccess, error: notifyError } = useNotify();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const [selectedSource, setSelectedSource] = useState<ReportSource>('assets');
  const [reports, setReports] = useState<Record<ReportSource, ReportData>>({} as any);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchAllReports = async () => {
    setLoading(true);
    try {
      const entries = Object.entries(SOURCE_CONFIG) as [ReportSource, typeof SOURCE_CONFIG[ReportSource]][];
      const promises = entries.map(async ([key, config]) => {
        const { data, error } = await supabase.from(config.table).select('*');
        if (error) throw error;
        const items = data || [];
        const statusCounts: Record<string, number> = {};
        items.forEach((item: any) => {
          const status = item[config.statusField] || 'unknown';
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        return [key, { label: config.label, count: items.length, details: statusCounts, rawData: items }] as const;
      });
      const results = await Promise.all(promises);
      setReports(Object.fromEntries(results) as any);
    } catch (err: any) {
      console.error('Error fetching reports:', err);
      notifyError('Error al cargar reportes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAllReports(); }, []);

  const currentReport = reports[selectedSource];
  const filteredData = useMemo(() => {
    if (!currentReport) return [];
    if (!searchTerm) return currentReport.rawData;
    const q = searchTerm.toLowerCase();
    const config = SOURCE_CONFIG[selectedSource];
    return currentReport.rawData.filter((item: any) =>
      String(item[config.titleField] || '').toLowerCase().includes(q)
    );
  }, [currentReport, searchTerm, selectedSource]);

  const statusColors: Record<string, string> = {
    active: 'text-slate-500',
    inactive: 'text-slate-500',
    maintenance: 'text-slate-500',
    damaged: 'text-slate-500',
    open: 'text-slate-500',
    in_progress: 'text-slate-500',
    resolved: 'text-slate-500',
    closed: 'text-slate-500',
    pending: 'text-slate-500',
    in_transit: 'text-slate-500',
    delivered: 'text-slate-500',
  };

  const handleExportExcel = async () => {
    if (!currentReport) return;
    setExporting('excel');
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(SOURCE_CONFIG[selectedSource].label);

      const config = SOURCE_CONFIG[selectedSource];
      const columns = Object.keys(currentReport.rawData[0] || {}).slice(0, 15).map(k => ({
        header: k, key: k, width: 25
      }));
      worksheet.columns = columns;
      worksheet.getRow(1).font = { bold: true, size: 11 };
      worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002855' } };
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

      filteredData.forEach((item: any) => {
        const row: any = {};
        columns.forEach(col => { row[col.key] = item[col.key] ?? ''; });
        worksheet.addRow(row);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte_${config.label.toLowerCase()}_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      notifySuccess('Reporte exportado a Excel');
    } catch (err) {
      notifyError('Error al exportar Excel');
    } finally {
      setExporting(null);
    }
  };

  const handleExportPDF = () => {
    if (!currentReport) return;
    setExporting('pdf');
    try {
      const doc = new jsPDF();
      const config = SOURCE_CONFIG[selectedSource];
      const entries = Object.entries(currentReport.details);
      doc.setFontSize(16);
      doc.text(`Reporte: ${config.label}`, 14, 20);
      doc.setFontSize(10);
      doc.text(`Total: ${currentReport.count} registros`, 14, 28);
      doc.setFontSize(12);
      doc.text('Resumen por Estado:', 14, 38);

      const summaryData = entries.map(([k, v]) => [k, String(v)]);
      autoTable(doc, {
        head: [['Estado', 'Cantidad']],
        body: summaryData,
        startY: 42,
        theme: 'grid',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [0, 40, 85] },
      });

      const tableStart = (doc as any).lastAutoTable.finalY + 10 || 50;
      const tableData = filteredData.slice(0, 50).map((item: any) =>
        Object.values(item).slice(0, 6).map(v => String(v ?? ''))
      );
      const headers = Object.keys(filteredData[0] || {}).slice(0, 6);

      if (tableData.length > 0) {
        autoTable(doc, {
          head: [headers],
          body: tableData,
          startY: tableStart,
          theme: 'striped',
          styles: { fontSize: 7 },
          headStyles: { fillColor: [0, 40, 85] },
        });
      }

      doc.save(`reporte_${config.label.toLowerCase()}_${new Date().toISOString().split('T')[0]}.pdf`);
      notifySuccess('Reporte exportado a PDF');
    } catch (err) {
      notifyError('Error al exportar PDF');
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <LoadingSpinner label="Cargando reportes..." />
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f8f9fc]">
      <div className="p-6 space-y-6 flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-white border border-slate-200 p-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-[#002855] p-2.5">
                <BarChart3 size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-black text-[#002855] uppercase tracking-tight">Reportes Avanzados</h1>
                <p className="text-[11px] font-bold text-slate-400">Visión consolidada del sistema</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportExcel}
                disabled={exporting !== null}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50"
              >
                {exporting === 'excel' ? <Loader size={14} /> : <RiFileExcel2Fill size={16} />}
                Excel
              </button>
              <button
                onClick={handleExportPDF}
                disabled={exporting !== null}
                className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all disabled:opacity-50"
              >
                {exporting === 'pdf' ? <Loader size={14} /> : <FaFilePdf size={16} />}
                PDF
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {(Object.entries(SOURCE_CONFIG) as [ReportSource, typeof SOURCE_CONFIG[ReportSource]][]).map(([key, config]) => {
            const data = reports[key];
            return (
              <button
                key={key}
                onClick={() => setSelectedSource(key)}
                className={`bg-white border p-4 text-left transition-all hover:shadow-md ${selectedSource === key ? 'border-[#002855] ring-2 ring-[#002855]/20' : 'border-slate-200'
                  }`}
              >
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{config.label}</p>
                <p className="text-2xl font-black text-[#002855]">{data?.count ?? 0}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {data && Object.entries(data.details).slice(0, 3).map(([status, count]) => (
                    <span key={status} className="text-[14px] font-semibold text-slate-800">
                      {status}: {count}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail Section */}
        {currentReport && (
          <div className="bg-white border border-slate-200">
            <div className="border-b border-slate-100 p-4">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Download size={16} className="text-[#002855]" />
                  <span className="text-sm font-black text-[#002855] uppercase tracking-tight">
                    {SOURCE_CONFIG[selectedSource].label} — {filteredData.length} registros
                  </span>
                </div>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9 pr-3 py-2 text-[11px] bg-slate-50 border border-slate-200 outline-none focus:border-[#002855]/30 w-full md:w-64"
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Status distribution */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 p-4 border-b border-slate-100">
              {Object.entries(currentReport.details).map(([status, count]) => {
                const pct = currentReport.count > 0 ? ((count / currentReport.count) * 100).toFixed(1) : '0';
                return (
                  <div key={status} className="bg-slate-50 p-3 border border-slate-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest truncate">{status}</span>
                      <span className={`text-[9px] font-black ${statusColors[status] || 'text-slate-500'}`}>
                        {count}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5">
                      <div className="bg-[#002855] h-1.5 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 mt-1">{pct}%</p>
                  </div>
                );
              })}
            </div>

            {/* Data table - desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="gsc-table w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    {filteredData[0] && Object.keys(filteredData[0]).slice(0, 8).map(key => (
                      <th key={key} className="text-left px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredData.slice(0, 100).map((item: any, idx: number) => (
                    <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      {Object.values(item).slice(0, 8).map((val: any, colIdx: number) => (
                        <td key={colIdx} className="px-4 py-2.5 text-[11px] font-medium text-slate-700 truncate max-w-[200px]">
                          {String(val ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Data cards - mobile */}
            <div className="md:hidden space-y-3 p-4">
              {filteredData.slice(0, 50).map((item: any, idx: number) => (
                <div key={idx} className="bg-white border border-slate-200 p-4 space-y-1.5">
                  {Object.entries(item).slice(0, 5).map(([key, val]: [string, any]) => (
                    <div key={key} className="flex items-start gap-2">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest shrink-0 w-20 truncate">{key}:</span>
                      <span className="text-[11px] font-medium text-slate-700 break-words min-w-0">{String(val ?? '—')}</span>
                    </div>
                  ))}
                </div>
              ))}
              {filteredData.length > 50 && (
                <div className="p-4 text-center text-[10px] font-bold text-slate-400">
                  Mostrando 50 de {filteredData.length} registros
                </div>
              )}
              {filteredData.length === 0 && (
                <div className="p-10 text-center bg-slate-50 border border-slate-100 mt-4 rounded-lg">
                  <FileText size={32} className="text-slate-200 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-400">Sin resultados</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
