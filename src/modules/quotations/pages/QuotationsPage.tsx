import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, DollarSign, Eye, X, FileText } from 'lucide-react';
import { FaFilePdf } from 'react-icons/fa6';
import { RiFileExcel2Fill } from 'react-icons/ri';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../../../shared/services/supabase';
import { useAuth } from '../../../app/providers/AuthContext';
import { useNotify } from '../../../shared/hooks/useNotify';
import { emailService } from '../../../shared/services/emailService';
import QuotationForm from '../forms/QuotationForm';
import StatusBadge from '../../../shared/components/ui/StatusBadge';
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  TableCellPrimary, TableCellSecondary, TableActionButton
} from '../../../shared/components/ui/Table';
import DetailModal, {
  DetailModalHeader, DetailModalBody, DetailModalGrid, DetailModalSection, DetailModalCard, DetailModalRow,
} from '../../../shared/components/ui/DetailModal';

export default function QuotationsPage() {
  const { canEdit } = useAuth();
  const { success: notifySuccess, error: notifyError, confirm } = useNotify();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('quotations').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setQuotations(data || []);
    } catch (err) {
      console.error('Error fetching quotations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('quotations-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotations' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    let result = [...quotations];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(r =>
        r.title?.toLowerCase().includes(q) ||
        r.number?.toLowerCase().includes(q) ||
        r.client_name?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') result = result.filter(r => r.status === statusFilter);
    return result;
  }, [quotations, searchTerm, statusFilter]);

  const statuses = ['all', ...new Set(quotations.map(r => r.status).filter(Boolean))];

  const handleExportExcel = async () => {
    setExporting('excel');
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Cotizaciones');
      ws.columns = [
        { header: 'N°', key: 'number', width: 20 },
        { header: 'Título', key: 'title', width: 40 },
        { header: 'Cliente', key: 'client_name', width: 30 },
        { header: 'Moneda', key: 'currency', width: 10 },
        { header: 'Subtotal', key: 'subtotal', width: 15 },
        { header: 'Total', key: 'total', width: 15 },
        { header: 'Estado', key: 'status', width: 15 },
        { header: 'Válido Hasta', key: 'valid_until', width: 15 },
      ];
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002855' } };
      filtered.forEach(r => ws.addRow(r));
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `cotizaciones_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
    } catch { notifyError('Error al exportar Excel'); }
    finally { setExporting(null); }
  };

  const handleExportPDF = () => {
    setExporting('pdf');
    try {
      const doc = new jsPDF();
      const data = filtered.map(r => [r.number, r.title, r.client_name, r.total ? `${r.currency === 'PEN' ? 'S/' : '$'}${r.total.toFixed(2)}` : '', r.status]);
      autoTable(doc, {
        head: [['N°', 'Título', 'Cliente', 'Total', 'Estado']],
        body: data, theme: 'grid', styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 40, 85] },
      });
      doc.save(`cotizaciones_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch { notifyError('Error al exportar PDF'); }
    finally { setExporting(null); }
  };

  const handleSendEmail = async (q: any) => {
    const currencySymbol = q.currency === 'PEN' ? 'S/' : '$';
    const itemsRows = (q.items || []).map((item: any) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #eef2f6;font-size:13px;">${item.description}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eef2f6;font-size:13px;text-align:center;">${item.quantity}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eef2f6;font-size:13px;text-align:right;">${currencySymbol}${item.unit_price.toFixed(2)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eef2f6;font-size:13px;text-align:right;font-weight:600;">${currencySymbol}${item.total.toFixed(2)}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: sans-serif;max-width:680px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eef2f6;">
        <div style="background:#002855;padding:24px 28px;">
          <h1 style="color:#fff;margin:0;font-size:22px;">COTIZACIÓN ${q.number}</h1>
          <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:13px;">${q.title}</p>
        </div>
        <div style="padding:28px 24px;">
          <div style="background:#f8fafc;border:1px solid #eef2f6;border-radius:8px;padding:16px;margin-bottom:20px;">
            <p style="margin:2px 0;font-size:14px;font-weight:600;">${q.client_name}</p>
            <p style="margin:2px 0;font-size:13px;">${q.client_email}</p>
          </div>
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
            <thead><tr style="background:#002855;color:#fff;"><th style="padding:10px;font-size:11px;text-align:left;">Descripción</th><th style="padding:10px;font-size:11px;text-align:center;">Cant.</th><th style="padding:10px;font-size:11px;text-align:right;">P.Unit</th><th style="padding:10px;font-size:11px;text-align:right;">Total</th></tr></thead>
            <tbody>${itemsRows}</tbody>
          </table>
          <div style="margin-left:auto;width:280px;text-align:right;">
            <p style="font-size:13px;margin:4px 0;">Subtotal: ${currencySymbol}${q.subtotal?.toFixed(2)}</p>
            <p style="font-size:16px;font-weight:700;margin:8px 0;color:#002855;">Total: ${currencySymbol}${q.total?.toFixed(2)}</p>
          </div>
        </div>
        <div style="background:#002855;padding:16px;text-align:center;">
          <p style="color:#cbd5e1;margin:0;font-size:11px;">Sistema GSC — Área de TI y Soporte</p>
        </div>
      </div>`;

    const result = await emailService.sendEmail({
      to: [q.client_email],
      subject: `Cotización ${q.number} - ${q.title}`,
      html,
    });
    if (result.success) notifySuccess('Cotización enviada por correo');
    else notifyError('Error: ' + result.error);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm('¿Eliminar esta cotización?', 'Eliminar Cotización');
    if (!ok) return;
    try {
      const { error } = await supabase.from('quotations').delete().eq('id', id);
      if (error) throw error;
      fetchData();
      notifySuccess('Cotización eliminada');
    } catch (err: any) {
      notifyError('Error: ' + err.message);
    }
  };

  const currencySymbol = (c: string) => c === 'PEN' ? 'S/' : '$';

  return (
    <div className="flex flex-col h-full bg-[#f8f9fc]">
      <div className="p-6 space-y-6 flex-1 overflow-y-auto">
        <div className="bg-white border border-slate-200 p-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
            <div className="flex-1 relative group/search">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-[#002855] transition-colors" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 text-[12px] text-[#002855] bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#002855]/30 focus:ring-4 focus:ring-[#002855]/5 outline-none transition-all placeholder:text-slate-300 tracking-[0.1em]" />
            </div>
            <div className="flex items-center gap-2">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="px-4 py-3 bg-slate-50 border border-slate-200 text-[10px] font-black text-[#002855] uppercase tracking-widest outline-none">
                <option value="all">TODOS LOS ESTADOS</option>
                {statuses.filter(s => s !== 'all').map(s => (
                  <option key={s} value={s}>{s === 'draft' ? 'Borrador' : s === 'sent' ? 'Enviada' : s === 'approved' ? 'Aprobada' : s === 'rejected' ? 'Rechazada' : s}</option>
                ))}
              </select>
              <button onClick={handleExportExcel} disabled={exporting !== null}
                className="flex items-center justify-center w-10 h-10 bg-white text-slate-400 border border-slate-200 hover:text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50 transition-all" title="Exportar Excel">
                <RiFileExcel2Fill size={20} />
              </button>
              <button onClick={handleExportPDF} disabled={exporting !== null}
                className="flex items-center justify-center w-10 h-10 bg-white text-slate-400 border border-slate-200 hover:text-rose-700 hover:border-rose-200 hover:bg-rose-50 transition-all" title="Exportar PDF">
                <FaFilePdf size={20} />
              </button>
              {canEdit() && (
                <button onClick={() => { setEditing(null); setShowForm(true); }}
                  className="flex items-center gap-2 px-4 py-3 bg-[#002855] text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-800 transition-all shadow-sm">
                  <Plus size={14} /> Nueva Cotización
                </button>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner label="Cargando cotizaciones..." />
        ) : filtered.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-100 p-20 text-center">
            <div className="w-20 h-20 bg-slate-50 flex items-center justify-center mx-auto mb-6">
              <DollarSign size={40} className="text-slate-200" />
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">No hay cotizaciones</h3>
            <p className="text-slate-400 max-w-xs mx-auto mt-2 text-sm">Crea una nueva cotización para comenzar.</p>
          </div>
        ) : (
          <>
            <div className="hidden md:flex bg-white border border-slate-200 shadow-sm overflow-hidden flex-col">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <tr>
                      <TableHead><span className="text-[11px] font-black text-[#002855] uppercase tracking-[0.2em]">N°</span></TableHead>
                      <TableHead><span className="text-[11px] font-black text-[#002855] uppercase tracking-[0.2em]">Título / Cliente</span></TableHead>
                      <TableHead><span className="text-[11px] font-black text-[#002855] uppercase tracking-[0.2em]">Total</span></TableHead>
                      <TableHead><span className="text-[11px] font-black text-[#002855] uppercase tracking-[0.2em]">Estado</span></TableHead>
                      <TableHead className="text-right"><span className="text-[11px] font-black text-[#002855] uppercase tracking-[0.2em]">Acciones</span></TableHead>
                    </tr>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((q: any) => (
                      <TableRow key={q.id} className="cursor-pointer" onClick={() => { setSelected(q); setShowDetails(true); }}>
                        <TableCell>
                          <TableCellPrimary className="text-blue-600 font-mono text-[11px]">{q.number}</TableCellPrimary>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <TableCellPrimary className="truncate max-w-xs">{q.title}</TableCellPrimary>
                            <TableCellSecondary>{q.client_name}</TableCellSecondary>
                          </div>
                        </TableCell>
                        <TableCell>
                          <TableCellPrimary>{currencySymbol(q.currency)} {q.total?.toFixed(2)}</TableCellPrimary>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={q.status || 'draft'} size="sm" />
                        </TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <TableActionButton icon={<Eye size={14} />} onClick={() => { setSelected(q); setShowDetails(true); }} title="Ver detalle" />
                            {canEdit() && (
                              <TableActionButton icon={<FaFilePdf size={14} />} onClick={() => handleSendEmail(q)} title="Enviar por correo" />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Mobile card view */}
            <div className="md:hidden space-y-3 mt-4">
              {filtered.map((q: any) => (
                <div key={q.id} className="bg-white border border-slate-200 relative">
                  <div className="p-4" onClick={() => { setSelected(q); setShowDetails(true); }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black text-blue-600 font-mono">{q.number}</p>
                        <p className="text-[13px] font-black text-[#002855] uppercase truncate">{q.title}</p>
                      </div>
                      <StatusBadge status={q.status || 'draft'} size="sm" />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px] font-bold text-slate-500 truncate">{q.client_name}</span>
                      <span className="text-[14px] font-black text-[#002855]">{currencySymbol(q.currency)} {q.total?.toFixed(2)}</span>
                    </div>
                  </div>
                  {/* + button */}
                  <button onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === q.id ? null : q.id); }}
                    className="absolute bottom-2 right-2 w-8 h-8 flex items-center justify-center bg-[#002855] text-white text-lg font-bold shadow-md active:scale-95 transition-transform">
                    +
                  </button>
                  {/* Floating menu */}
                  {activeMenuId === q.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setActiveMenuId(null)} />
                      <div className="absolute bottom-12 right-2 z-50 bg-white border border-slate-200 shadow-xl min-w-[140px]">
                        <button onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); setSelected(q); setShowDetails(true); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-black text-slate-700 hover:bg-slate-50 border-b border-slate-100 uppercase tracking-widest">
                          Ver Detalle
                        </button>
                        {canEdit() && (
                          <button onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); handleSendEmail(q); }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-black text-blue-600 hover:bg-blue-50 uppercase tracking-widest">
                            Enviar
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showForm && (
        <QuotationForm
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={() => { setShowForm(false); setEditing(null); fetchData(); }}
          editRecord={editing}
        />
      )}

      {showDetails && selected && (
        <DetailModal maxWidth="4xl" onClose={() => setShowDetails(false)} closeOnBackdrop>
          <DetailModalHeader>
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 shrink-0 bg-white/10 border border-white/20 flex items-center justify-center text-white">
                <DollarSign size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[16px] font-normal text-white uppercase tracking-tight">{selected.number}</h2>
                <p className="text-[10px] font-normal text-blue-200 uppercase">{selected.title}</p>
              </div>
            </div>
            <button onClick={() => setShowDetails(false)} className="p-2 text-white/50 hover:text-white hover:bg-white/10 transition-all"><X size={20} /></button>
          </DetailModalHeader>
          <DetailModalBody>
            <DetailModalGrid layout="stack-until-xl">
              <DetailModalSection title="Cliente">
                <DetailModalCard>
                  <DetailModalRow label="Nombre"><span className="text-[11px] font-normal text-slate-700">{selected.client_name}</span></DetailModalRow>
                  <DetailModalRow label="Email"><span className="text-[11px] font-medium text-slate-600">{selected.client_email}</span></DetailModalRow>
                  {selected.client_phone && <DetailModalRow label="Teléfono"><span className="text-[11px] font-medium text-slate-600">{selected.client_phone}</span></DetailModalRow>}
                </DetailModalCard>
              </DetailModalSection>
              <DetailModalSection title="Resumen">
                <DetailModalCard>
                  <DetailModalRow label="Moneda"><span className="text-[11px] font-normal text-slate-700">{selected.currency === 'PEN' ? 'Soles (S/)' : 'Dólares ($)'}</span></DetailModalRow>
                  <DetailModalRow label="Subtotal"><span className="text-[11px] font-normal text-slate-700">{currencySymbol(selected.currency)} {selected.subtotal?.toFixed(2)}</span></DetailModalRow>
                  {selected.discount > 0 && <DetailModalRow label="Descuento"><span className="text-[11px] font-normal text-rose-600">-{currencySymbol(selected.currency)} {selected.discount_amount?.toFixed(2)}</span></DetailModalRow>}
                  <DetailModalRow label="IGV"><span className="text-[11px] font-normal text-slate-700">{currencySymbol(selected.currency)} {selected.tax_amount?.toFixed(2)}</span></DetailModalRow>
                  <DetailModalRow label="TOTAL"><span className="text-[14px] font-normal text-[#002855]">{currencySymbol(selected.currency)} {selected.total?.toFixed(2)}</span></DetailModalRow>
                </DetailModalCard>
                <DetailModalCard>
                  <DetailModalRow label="Estado"><StatusBadge status={selected.status || 'draft'} size="md" /></DetailModalRow>
                  <DetailModalRow label="Válido Hasta"><span className="text-[11px] font-medium text-slate-600">{selected.valid_until ? new Date(selected.valid_until).toLocaleDateString('es-PE') : '—'}</span></DetailModalRow>
                </DetailModalCard>
              </DetailModalSection>
              {(selected.items || []).length > 0 && (
                <DetailModalSection title="Items" className="col-span-full">
                  <div className="bg-white border border-slate-200">
                    <table className="w-full text-left">
                      <thead className="bg-[#002855] text-white">
                        <tr>
                          <th className="px-4 py-2 text-[9px] font-normal uppercase tracking-widest">Descripción</th>
                          <th className="px-4 py-2 text-[9px] font-normal uppercase tracking-widest text-center">Cant.</th>
                          <th className="px-4 py-2 text-[9px] font-normal uppercase tracking-widest text-right">P. Unit.</th>
                          <th className="px-4 py-2 text-[9px] font-normal uppercase tracking-widest text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(selected.items || []).map((item: any, idx: number) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 text-[12px] font-normal text-slate-700">{item.description}</td>
                            <td className="px-4 py-2 text-[12px] text-slate-600 text-center">{item.quantity}</td>
                            <td className="px-4 py-2 text-[12px] text-slate-600 text-right">{currencySymbol(selected.currency)} {item.unit_price?.toFixed(2)}</td>
                            <td className="px-4 py-2 text-[12px] font-normal text-slate-700 text-right">{currencySymbol(selected.currency)} {item.total?.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DetailModalSection>
              )}
              {selected.notes && (
                <DetailModalSection title="Notas">
                  <DetailModalCard><p className="text-[11px] text-slate-600 leading-relaxed">{selected.notes}</p></DetailModalCard>
                </DetailModalSection>
              )}
            </DetailModalGrid>
          </DetailModalBody>
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50">
            <button onClick={() => handleSendEmail(selected)}
              className="flex items-center gap-2 px-4 py-2 text-[10px] font-normal text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-500 hover:text-white transition-all uppercase tracking-widest">
              Enviar por Correo
            </button>
            <button onClick={() => setShowDetails(false)}
              className="px-6 py-2 text-[10px] font-normal text-white bg-[#002855] hover:bg-blue-800 transition-all uppercase tracking-widest">
              Cerrar
            </button>
          </div>
        </DetailModal>
      )}
    </div>
  );
}
