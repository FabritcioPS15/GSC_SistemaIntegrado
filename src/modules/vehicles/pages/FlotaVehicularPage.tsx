import { useEffect, useState, useMemo } from 'react';
import { Plus, Edit, Trash2, MapPin, X, Car, List, Search, Calendar, Filter } from 'lucide-react';
import { RiFileExcel2Fill } from "react-icons/ri";
import { FaFilePdf } from "react-icons/fa6";
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import VehicleImportModal from '../components/VehicleImportModal';
import FlotaVehicularForm from '../forms/FlotaVehicularForm';
import Pagination from '../../../shared/components/ui/Pagination';
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner';
import { supabase, Location } from '../../../shared/services/supabase';
import { BUSINESS_TYPE_LABELS } from '../../../shared/types/inventory.types';
import { useAuth } from '../../../app/providers/AuthContext';
import { useNotify } from '../../../shared/hooks/useNotify';
import DetailModal, {
  DetailModalHeader,
  DetailModalBody,
  StandardModalFooter,
} from '../../../shared/components/ui/DetailModal';
import ActionToolbar from '../../../shared/components/ui/ActionToolbar';
import ActionsDropdown from '../../../shared/components/ui/ActionsDropdown';
import { useSelectionMode } from '../../../shared/hooks/useSelectionMode';
import FilterBar from '../../../shared/components/ui/FilterBar';
import ViewToggle from '../../../shared/components/ui/ViewToggle';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  TableCellPrimary,
} from '../../../shared/components/ui/Table';

type Vehiculo = {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  categoria?: string;
  año: number;
  estado: 'activa' | 'inactiva' | 'en_proceso';
  ubicacion_actual: string;
  imagen_url?: string;
  fecha_ultimo_mantenimiento: string;
  notas: string;
  citv_emision?: string;
  citv_vencimiento?: string;
  soat_emision?: string;
  soat_vencimiento?: string;
  poliza_emision?: string;
  poliza_vencimiento?: string;
  contrato_alquiler_emision?: string;
  contrato_alquiler_vencimiento?: string;
  color?: string;
  image_position?: string;
};

export default function FlotaVehicular() {
  const { canEdit } = useAuth();
  const { success: notifySuccess, error: notifyError, confirm } = useNotify();
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editing, setEditing] = useState<Vehiculo | undefined>();
  const [filterEstado, setFilterEstado] = useState<string[]>([]);
  const [filterCategoria, setFilterCategoria] = useState<string[]>([]);
  const [selectedRubros, setSelectedRubros] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [schools, setSchools] = useState<Location[]>([]);

  const filteredSchools = useMemo(() => {
    if (selectedRubros.length === 0) return schools;
    return schools.filter(s => s.business_type && selectedRubros.includes(s.business_type));
  }, [schools, selectedRubros]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [showDetails, setShowDetails] = useState(false);
  const [selectedVehiculo, setSelectedVehiculo] = useState<Vehiculo | undefined>();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { selectionMode, setSelectionMode } = useSelectionMode();

  const handleToggleSelectionMode = () => {
    if (selectionMode) setSelectedIds([]);
    setSelectionMode(!selectionMode);
  };

  useEffect(() => {
    fetchSchools();
    fetchVehiculos();
  }, []);

  const fetchSchools = async () => {
    try {
      const { data, error } = await supabase.from('locations').select('*, companies(id, name)').eq('is_active', true).order('name');
      if (!error && data) setSchools(data as Location[]);
    } catch (error) {
      console.error('Error al cargar ubicaciones:', error);
    }
  };

  const fetchVehiculos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('vehiculos').select('*').order('placa');
      if (error) throw error;
      setVehiculos(data || []);
    } catch (error) {
      console.error('Error al cargar vehículos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getEscuelaNombre = (ubicacionActual: string) => {
    const school = schools.find(s => s.id === ubicacionActual);
    return school ? school.name : (ubicacionActual || 'Sin asignar');
  };



  // Días restantes hasta vencimiento (negativo = ya venció)
  const getDaysUntil = (fecha?: string): number => {
    if (!fecha) return Infinity;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(fecha + 'T00:00:00'); d.setHours(0, 0, 0, 0);
    return Math.ceil((d.getTime() - today.getTime()) / 86400000);
  };

  // Vehículos con algún documento vencido o por vencer en <= 30 días
  const getVencimientoReport = () => {
    const DIAS_ALERTA = 30;
    return vehiculos
      .filter(v => {
        const dias = [
          getDaysUntil(v.citv_vencimiento),
          getDaysUntil(v.soat_vencimiento),
          getDaysUntil(v.poliza_vencimiento),
        ];
        return dias.some(d => d <= DIAS_ALERTA);
      })
      .sort((a, b) => {
        // Ordenar por el documento más urgente primero
        const minA = Math.min(
          getDaysUntil(a.citv_vencimiento),
          getDaysUntil(a.soat_vencimiento),
          getDaysUntil(a.poliza_vencimiento),
        );
        const minB = Math.min(
          getDaysUntil(b.citv_vencimiento),
          getDaysUntil(b.soat_vencimiento),
          getDaysUntil(b.poliza_vencimiento),
        );
        return minA - minB;
      });
  };


  const handleExportVencimientosExcel = async () => {
    try {
      const reporte = getVencimientoReport();
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Vencimientos');

      ws.columns = [
        { header: 'PLACA', key: 'placa', width: 14 },
        { header: 'MARCA / MODELO', key: 'vehiculo', width: 25 },
        { header: 'UBICACIÓN', key: 'sede', width: 28 },
        { header: 'CITV VENCE', key: 'citv', width: 16 },
        { header: 'CITV ESTADO', key: 'citv_estado', width: 20 },
        { header: 'SOAT VENCE', key: 'soat', width: 16 },
        { header: 'SOAT ESTADO', key: 'soat_estado', width: 20 },
        { header: 'PÓLIZA VENCE', key: 'poliza', width: 16 },
        { header: 'PÓLIZA ESTADO', key: 'poliza_estado', width: 20 },
      ];

      // Estilo encabezado
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002855' } };
      ws.getRow(1).height = 24;

      const estadoDoc = (fecha?: string) => {
        if (!fecha) return 'Sin fecha';
        const d = getDaysUntil(fecha);
        if (d <= 0) return `VENCIDO (${Math.abs(d)} días)`;
        if (d <= 7) return `CRÍTICO (${d} días)`;
        if (d <= 30) return `POR VENCER (${d} días)`;
        if (d >= 270) return `VIGENTE (${d} días)`;
        return `OK (${d} días)`;
      };

      // Color de fila por documento más urgente
      const fillColor = (minDias: number) => {
        if (minDias <= 7) return { argb: 'FFFDE8E8' }; // rojo claro
        if (minDias <= 30) return { argb: 'FFFFF3CD' }; // amarillo
        if (minDias >= 270) return { argb: 'FFD1FAE5' }; // verde claro
        return null; // sin color
      };

      reporte.forEach(v => {
        const row = ws.addRow({
          placa: v.placa,
          vehiculo: `${v.marca} ${v.modelo}`,
          sede: getEscuelaNombre(v.ubicacion_actual),
          citv: v.citv_vencimiento ? new Date(String(v.citv_vencimiento + 'T00:00:00').includes('T') ? String(v.citv_vencimiento + 'T00:00:00') : `${v.citv_vencimiento + 'T00:00:00'}T12:00:00`).toLocaleDateString('es-PE') : '—',
          citv_estado: estadoDoc(v.citv_vencimiento),
          soat: v.soat_vencimiento ? new Date(String(v.soat_vencimiento + 'T00:00:00').includes('T') ? String(v.soat_vencimiento + 'T00:00:00') : `${v.soat_vencimiento + 'T00:00:00'}T12:00:00`).toLocaleDateString('es-PE') : '—',
          soat_estado: estadoDoc(v.soat_vencimiento),
          poliza: v.poliza_vencimiento ? new Date(String(v.poliza_vencimiento + 'T00:00:00').includes('T') ? String(v.poliza_vencimiento + 'T00:00:00') : `${v.poliza_vencimiento + 'T00:00:00'}T12:00:00`).toLocaleDateString('es-PE') : '—',
          poliza_estado: estadoDoc(v.poliza_vencimiento),
        });

        // Colorear fila según urgencia
        const minDias = Math.min(
          getDaysUntil(v.citv_vencimiento),
          getDaysUntil(v.soat_vencimiento),
          getDaysUntil(v.poliza_vencimiento),
        );
        const color = fillColor(minDias);
        if (color) {
          row.fill = { type: 'pattern', pattern: 'solid', fgColor: color };
        }

        row.eachCell(cell => {
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          cell.alignment = { vertical: 'middle' };
        });
      });

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Reporte Vencimientos Flota.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
  };

  const handleExportVencimientosPdf = async () => {
    try {
      const reporte = getVencimientoReport();
      const doc = new jsPDF('l', 'mm', 'a4');
      const pageW = doc.internal.pageSize.width;

      // Cargar logo ANTES del autoTable (síncrono en el header)
      let logoBase64 = '';
      try {
        const res = await fetch('/Enblanco.png');
        const blob = await res.blob();
        logoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch { /* sin logo */ }

      // drawHeader SÍNCRONO (didDrawPage no soporta async)
      const drawHeader = () => {
        doc.setFillColor(0, 0, 0);
        doc.rect(0, 0, pageW, 24, 'F');

        doc.setFillColor(250, 140, 0);
        doc.rect(0, 24, pageW, 3, 'F');

        doc.setFillColor(180, 180, 180);
        doc.rect(0, 27, pageW, 1, 'F');

        if (logoBase64) {
          try {
            const logoH = 16;
            const logoW = logoH * 3.5;
            doc.addImage(logoBase64, 'PNG', pageW - logoW - 6, 4, logoW, logoH);
          } catch (_) { /* ignorar */ }
        }

        doc.setFontSize(17);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('Reporte de Vencimientos — Flota Vehicular', 10, 13);

        const now = new Date();
        const fechaHora = now.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })
          + '  •  ' + now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(200, 200, 200);
        doc.text(fechaHora, 10, 18);
      };

      // Dibujar encabezado en primera página
      drawHeader();

      // Subtexto
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Vehículos con documentos vencidos o por vencer en los próximos 30 días  |  Total: ${reporte.length} vehículos`, 10, 34);

      const tableData = reporte.map(v => {
        const fmtDate = (f?: string) => f ? new Date(String(f + 'T00:00:00').includes('T') ? String(f + 'T00:00:00') : `${f + 'T00:00:00'}T12:00:00`).toLocaleDateString('es-PE') : '—';
        const fmtDias = (f?: string) => {
          if (!f) return '—';
          const d = getDaysUntil(f);
          if (d <= 0) return `VENCIDO (${Math.abs(d)}d)`;
          return `${d} días`;
        };
        return [
          v.placa,
          `${v.marca} ${v.modelo}`,
          getEscuelaNombre(v.ubicacion_actual),
          fmtDate(v.citv_vencimiento),
          fmtDias(v.citv_vencimiento),
          fmtDate(v.soat_vencimiento),
          fmtDias(v.soat_vencimiento),
          fmtDate(v.poliza_vencimiento),
          fmtDias(v.poliza_vencimiento),
        ];
      });

      autoTable(doc, {
        startY: 38,
        margin: { top: 36 },
        head: [['Placa', 'Vehículo', 'Ubicación', 'CITV Vence', 'CITV Estado', 'SOAT Vence', 'SOAT Estado', 'Póliza Vence', 'Póliza Estado']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [30, 30, 30],
          textColor: 255,
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle',
          cellPadding: 3,
        },
        styles: { fontSize: 7.5, cellPadding: 2.5, valign: 'middle' },
        columnStyles: {
          0: { halign: 'center', fontStyle: 'bold', cellWidth: 22 },
          1: { halign: 'left', cellWidth: 50 },
          2: { halign: 'left', cellWidth: 42 },
          3: { halign: 'center', cellWidth: 26 },
          4: { halign: 'center', cellWidth: 28 },
          5: { halign: 'center', cellWidth: 26 },
          6: { halign: 'center', cellWidth: 28 },
          7: { halign: 'center', cellWidth: 26 },
          8: { halign: 'center', cellWidth: 28 },
        },
        didParseCell: (data) => {
          if (data.section === 'head' && data.column.index >= 3) {
            data.cell.styles.fillColor = [154, 52, 18];
          }
          if (data.section === 'body') {
            const v = reporte[data.row.index];
            const minDias = Math.min(
              getDaysUntil(v.citv_vencimiento),
              getDaysUntil(v.soat_vencimiento),
              getDaysUntil(v.poliza_vencimiento),
            );
            if (minDias <= 0) {
              data.cell.styles.fillColor = [254, 202, 202];
              data.cell.styles.textColor = [153, 0, 0];
              data.cell.styles.fontStyle = 'bold';
            } else if (minDias <= 7) {
              data.cell.styles.fillColor = [254, 202, 202];
              data.cell.styles.textColor = [153, 0, 0];
            } else if (minDias <= 30) {
              data.cell.styles.fillColor = [253, 224, 71];
              data.cell.styles.textColor = [133, 77, 14];
            }
          }
        },
        didDrawPage: () => {
          // Síncrono: redibuja encabezado en CADA página
          drawHeader();
        },
      });

      doc.save(`Reporte Vencimientos Flota.pdf`);
    } catch (e) { console.error(e); }
  };

  const filteredVehiculos = useMemo(() => {
    return vehiculos.filter(v => {
      const q = search.toLowerCase();
      const searchMatch = !search || v.placa.toLowerCase().includes(q) || v.marca.toLowerCase().includes(q) || v.modelo.toLowerCase().includes(q) || (v.categoria || '').toLowerCase().includes(q);
      const rubroMatch = selectedRubros.length === 0 || selectedRubros.length === Object.keys(BUSINESS_TYPE_LABELS).length || (() => {
        const school = schools.find(s => s.id === v.ubicacion_actual);
        return school?.business_type ? selectedRubros.includes(school.business_type) : false;
      })();
      const sedeMatch = selectedLocations.length === 0 || selectedLocations.length === schools.length || selectedLocations.includes(v.ubicacion_actual);
      const estadoMatch = filterEstado.length === 0 || filterEstado.includes(v.estado);
      const categoriaMatch = filterCategoria.length === 0 || filterCategoria.includes(v.categoria || '');
      return searchMatch && rubroMatch && sedeMatch && estadoMatch && categoriaMatch;
    });
  }, [vehiculos, search, selectedRubros, selectedLocations, filterEstado, filterCategoria, schools]);

  const categoriasDisponibles = useMemo(() => {
    const categorias = vehiculos
      .map(v => (v.categoria || '').trim())
      .filter(Boolean);
    return Array.from(new Set(categorias)).sort((a, b) => a.localeCompare(b));
  }, [vehiculos]);

  const sortedVehiculos = useMemo(() => {
    if (!sortConfig) return filteredVehiculos;
    return [...filteredVehiculos].sort((a, b) => {
      const aVal = a[sortConfig.key as keyof Vehiculo];
      const bVal = b[sortConfig.key as keyof Vehiculo];
      if (aVal === bVal) return 0;
      const res = aVal! < bVal! ? -1 : 1;
      return sortConfig.direction === 'asc' ? res : -res;
    });
  }, [filteredVehiculos, sortConfig]);

  const totalPages = Math.ceil(sortedVehiculos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedVehiculos = sortedVehiculos.slice(startIndex, startIndex + itemsPerPage);

  const renderDocumentStatus = (fecha?: string) => {
    if (!fecha) {
      return (
        <span className="text-[14px] font-semibold text-slate-800">Sin fecha</span>
      );
    }

    const daysLeft = getDaysUntil(fecha);
    const dateStr = new Date(String(fecha + 'T00:00:00').includes('T') ? String(fecha + 'T00:00:00') : `${fecha + 'T00:00:00'}T12:00:00`).toLocaleDateString('es-PE');

    if (daysLeft <= 0) {
      return (
        <div className="flex flex-col items-start gap-1">
          <span className="text-[14px] font-semibold bg-rose-100 text-rose-700">Vencido ({Math.abs(daysLeft)}d)</span>
          <span className="text-[10px] font-black text-rose-600/80 ml-1">{dateStr}</span>
        </div>
      );
    }

    if (daysLeft <= 30) {
      return (
        <div className="flex flex-col items-start gap-1">
          <span className="text-[14px] font-semibold bg-amber-100 text-amber-700">Vence {daysLeft}d</span>
          <span className="text-[10px] font-black text-amber-600/80 ml-1">{dateStr}</span>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-start gap-1">
        <span className="text-[14px] font-semibold bg-emerald-100 text-emerald-700">Vigente ({daysLeft}d)</span>
        <span className="text-[10px] font-bold text-slate-500 ml-1">{dateStr}</span>
      </div>
    );
  };

  const renderPlacaBadge = (placa: string) => {
    return (
      <div className="inline-flex flex-col items-center bg-white border-2 border-slate-800 rounded-md shadow-sm overflow-hidden min-w-[90px]">
        <div className="w-full h-1.5 bg-[#002855]" />
        <span className="px-2 py-0.5 font-mono text-[14px] font-black text-slate-800 tracking-wider leading-none my-1">
          {placa}
        </span>
      </div>
    );
  };


  const handleView = (v: Vehiculo) => {
    setSelectedVehiculo(v);
    setShowDetails(true);
  };

  const handleEdit = (v: Vehiculo) => {
    setEditing(v);
    setView('form');
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm('¿Está seguro de eliminar esta unidad de la flota?', 'Eliminar Vehículo');
    if (!confirmed) return;
    try {
      const { error } = await supabase.from('vehiculos').delete().eq('id', id);
      if (error) throw error;
      await fetchVehiculos();
      notifySuccess('Unidad eliminada correctamente');
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
    } catch (e) {
      notifyError('Error al eliminar la unidad');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await confirm(`¿Está seguro de eliminar ${selectedIds.length} unidades seleccionadas?`, 'Eliminación por Lote');
    if (!confirmed) return;
    try {
      const { error } = await supabase.from('vehiculos').delete().in('id', selectedIds);
      if (error) throw error;
      await fetchVehiculos();
      notifySuccess('Unidades eliminadas correctamente');
      setSelectedIds([]);
    } catch (e) {
      notifyError('Error al eliminar las unidades');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = (items: Vehiculo[]) => {
    if (selectedIds.length === items.length && items.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map(i => i.id));
    }
  };

  const handleExportExcel = async () => {
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Flota Completa');

      // Ordenar por Sede/Ubicación
      const sortedData = [...filteredVehiculos].sort((a, b) => {
        const sedeA = getEscuelaNombre(a.ubicacion_actual).toLowerCase();
        const sedeB = getEscuelaNombre(b.ubicacion_actual).toLowerCase();
        return sedeA.localeCompare(sedeB);
      });

      // 1. Título y Cabecera del Reporte
      ws.mergeCells('A1:N1');
      const titleCell = ws.getCell('A1');
      titleCell.value = 'REPORTE GENERAL DE FLOTA VEHICULAR — GRUPO SAN CRISTÓBAL';
      titleCell.font = { name: 'Arial', family: 2, size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 40;

      // 2. Información General
      ws.mergeCells('A2:N2');
      const subtitleCell = ws.getCell('A2');
      subtitleCell.value = `Generado el: ${new Date().toLocaleDateString('es-PE')} ${new Date().toLocaleTimeString('es-PE')} | Total de unidades: ${sortedData.length} | Ordenado por Sede`;
      subtitleCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF475569' } };
      subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      subtitleCell.alignment = { horizontal: 'left', vertical: 'middle' };
      ws.getRow(2).height = 24;

      // Espacio vacío
      ws.addRow([]);

      // 3. Configuración de Columnas
      const columns = [
        { header: 'PLACA', key: 'placa', width: 14 },
        { header: 'MARCA', key: 'marca', width: 15 },
        { header: 'MODELO', key: 'modelo', width: 15 },
        { header: 'COLOR', key: 'color', width: 12 },
        { header: 'AÑO', key: 'año', width: 9 },
        { header: 'ESTADO', key: 'estado', width: 14 },
        { header: 'UBICACIÓN', key: 'sede', width: 28 },
        { header: 'CITV VENCE', key: 'citv', width: 15 },
        { header: 'SOAT VENCE', key: 'soat', width: 15 },
        { header: 'PÓLIZA VENCE', key: 'poliza', width: 15 },
        { header: 'ALQUILER VENCE', key: 'alquiler', width: 15 },
        { header: 'ÚLT. MANT.', key: 'mantenimiento', width: 15 },
        { header: 'NOTAS / OBSERVACIONES', key: 'notas', width: 35 },
        { header: 'CATEGORÍA', key: 'categoria', width: 18 }
      ];

      const headerRowIndex = 4;
      ws.getRow(headerRowIndex).values = columns.map(c => c.header);
      ws.getRow(headerRowIndex).font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      ws.getRow(headerRowIndex).height = 28;

      columns.forEach((_, i) => {
        const cell = ws.getRow(headerRowIndex).getCell(i + 1);

        // Colores de encabezados por grupo para hacerlo hiper-visual
        let headerColor = 'FF0F172A'; // Default dark slate
        if (i < 5) {
          headerColor = 'FF002855'; // Azul marino para Datos Básicos
        } else if (i >= 5 && i < 7) {
          headerColor = 'FF334155'; // Gris pizarra para Estado y Sede
        } else if (i >= 7 && i < 11) {
          headerColor = 'FF9A3412'; // Óxido / Naranja quemado para Fechas de Vencimiento de documentos
        } else {
          headerColor = 'FF1E293B'; // Slate oscuro para Mant y Notas
        }

        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColor } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF000000' } },
          bottom: { style: 'medium', color: { argb: 'FF000000' } }
        };
      });

      // Formato fecha
      const fmtDate = (f?: string) => f ? new Date(String(f + 'T00:00:00').includes('T') ? String(f + 'T00:00:00') : `${f + 'T00:00:00'}T12:00:00`).toLocaleDateString('es-PE') : '—';

      // 4. Agregar Datos
      sortedData.forEach((v, index) => {
        const row = ws.addRow([
          v.placa,
          v.marca,
          v.modelo,
          v.color || '—',
          v.año,
          v.estado === 'activa' ? 'ACTIVA' : v.estado === 'inactiva' ? 'INACTIVA' : 'EN PROCESO',
          getEscuelaNombre(v.ubicacion_actual),
          fmtDate(v.citv_vencimiento),
          fmtDate(v.soat_vencimiento),
          fmtDate(v.poliza_vencimiento),
          fmtDate(v.contrato_alquiler_vencimiento),
          fmtDate(v.fecha_ultimo_mantenimiento),
          v.notas || '—',
          v.categoria || '—'
        ]);

        row.height = 24;

        // Cebrado (Zebra striping)
        const isEven = index % 2 === 0;
        const bgRowColor = isEven ? 'FFF8FAFC' : 'FFFFFFFF';

        row.eachCell((cell, colIndex) => {
          // Borde delgado general
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
          cell.font = { name: 'Arial', size: 9 };
          cell.alignment = { vertical: 'middle' };

          // Por defecto, fondo cebrado
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgRowColor } };

          // Alinear placa, año, fechas y estado al centro
          if ([1, 5, 6, 8, 9, 10, 11, 12].includes(colIndex)) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
        });

        // Estilos específicos para Estado (Celda 6)
        const statusCell = row.getCell(6);
        if (v.estado === 'activa') {
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }; // Verde
          statusCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF065F46' } };
        } else if (v.estado === 'inactiva') {
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; // Rojo
          statusCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF991B1B' } };
        } else {
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // Amarillo
          statusCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF92400E' } };
        }

        // Resaltar vencimientos de documentos importantes (CITV: 8, SOAT: 9, Póliza: 10, Contrato: 11)
        const dateColumns = [
          { colIdx: 8, val: v.citv_vencimiento },
          { colIdx: 9, val: v.soat_vencimiento },
          { colIdx: 10, val: v.poliza_vencimiento },
          { colIdx: 11, val: v.contrato_alquiler_vencimiento }
        ];

        dateColumns.forEach(dCol => {
          if (dCol.val) {
            const daysLeft = getDaysUntil(dCol.val);
            const cell = row.getCell(dCol.colIdx);
            if (daysLeft <= 0) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } }; // Rojo intenso para vencidos
              cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF990000' } };
            } else if (daysLeft <= 30) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE047' } }; // Amarillo para vencer pronto
              cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF854D0E' } };
            }
          }
        });
      });

      // Ancho automático de columnas (con un límite mínimo)
      columns.forEach((col, i) => {
        const column = ws.getColumn(i + 1);
        column.width = col.width;
      });

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Reporte Flota Vehicular.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportPdf = async () => {
    try {
      const doc = new jsPDF('l', 'mm', 'a4');

      // Ordenar por Sede/Ubicación
      const sortedData = [...filteredVehiculos].sort((a, b) => {
        const sedeA = getEscuelaNombre(a.ubicacion_actual).toLowerCase();
        const sedeB = getEscuelaNombre(b.ubicacion_actual).toLowerCase();
        return sedeA.localeCompare(sedeB);
      });

      // Cargar logo corporativo
      const logoBase64 = await fetch('/Enblanco.png')
        .then(r => r.blob())
        .then(blob => new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }))
        .catch(() => '');

      const pageW = doc.internal.pageSize.width;

      // Helper: dibuja el encabezado unificado en la página actual
      const drawHeader = (titulo: string) => {
        doc.setFillColor(0, 0, 0);
        doc.rect(0, 0, pageW, 24, 'F');

        doc.setFillColor(255, 140, 0);
        doc.rect(0, 24, pageW, 3, 'F');

        doc.setFillColor(180, 180, 180);
        doc.rect(0, 27, pageW, 1, 'F');

        if (logoBase64) {
          try {
            const logoH = 16;
            const logoW = logoH * 3.5;
            doc.addImage(logoBase64, 'PNG', pageW - logoW - 6, 4, logoW, logoH);
          } catch (_) { /* ignorar */ }
        }

        doc.setFontSize(17);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(titulo, 10, 13);

        const now = new Date();
        const fechaHora = `${now.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}  •  ${now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(200, 200, 200);
        doc.text(fechaHora, 10, 18);
      };

      // 1. Dibujar encabezado en primera página
      drawHeader('REPORTE GENERAL DE FLOTA VEHICULAR');

      // Subtexto
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Total de Unidades: ${sortedData.length}  |  Ordenado por Ubicación`, 10, 34);

      // 2. Preparar Datos de la Tabla
      const tableData = sortedData.map(v => {
        const fmtDate = (f?: string) => f ? new Date(String(f + 'T00:00:00').includes('T') ? String(f + 'T00:00:00') : `${f + 'T00:00:00'}T12:00:00`).toLocaleDateString('es-PE') : '—';
        return [
          v.placa,
          `${v.marca} ${v.modelo} ${v.año ? `(${v.año})` : ''} ${v.color ? `[${v.color}]` : ''}`,
          v.estado === 'activa' ? 'ACTIVA' : v.estado === 'inactiva' ? 'INACTIVA' : 'EN PROCESO',
          getEscuelaNombre(v.ubicacion_actual),
          fmtDate(v.citv_vencimiento),
          fmtDate(v.soat_vencimiento),
          fmtDate(v.poliza_vencimiento),
          fmtDate(v.contrato_alquiler_vencimiento),
          fmtDate(v.fecha_ultimo_mantenimiento),
          v.categoria || '—'
        ];
      });

      // 3. Renderizar la tabla con estilos avanzados
      autoTable(doc, {
        startY: 38,
        margin: { top: 36 },
        head: [['Placa', 'Vehículo (Datos Generales)', 'Estado', 'Ubicación', 'CITV Vence', 'SOAT Vence', 'Póliza Vence', 'Contrato Vence', 'Últ. Mant.', 'Categoría']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [30, 30, 30],
          textColor: 255,
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle',
          cellPadding: 3
        },
        styles: {
          fontSize: 7.5,
          cellPadding: 2.5,
          valign: 'middle'
        },
        columnStyles: {
          0: { halign: 'center', fontStyle: 'bold', cellWidth: 22 },
          1: { halign: 'left', cellWidth: 55 },
          2: { halign: 'center', fontStyle: 'bold', cellWidth: 24 },
          3: { halign: 'left', cellWidth: 42 },
          4: { halign: 'center', cellWidth: 26 },
          5: { halign: 'center', cellWidth: 26 },
          6: { halign: 'center', cellWidth: 26 },
          7: { halign: 'center', cellWidth: 26 },
          8: { halign: 'center', cellWidth: 26 },
          9: { halign: 'center', cellWidth: 24 }
        },
        didParseCell: (data) => {
          if (data.section === 'head') {
            const colIdx = data.column.index;
            if (colIdx < 2) {
              data.cell.styles.fillColor = [30, 30, 30];
            } else if (colIdx >= 2 && colIdx < 4) {
              data.cell.styles.fillColor = [50, 50, 50];
            } else if (colIdx >= 4 && colIdx < 8) {
              data.cell.styles.fillColor = [154, 52, 18];
            } else {
              data.cell.styles.fillColor = [30, 30, 30];
            }
          }

          if (data.section === 'body') {
            const v = sortedData[data.row.index];
            const colIndex = data.column.index;

            if (colIndex === 2) {
              if (v.estado === 'activa') {
                data.cell.styles.fillColor = [209, 250, 229];
                data.cell.styles.textColor = [6, 95, 70];
              } else if (v.estado === 'inactiva') {
                data.cell.styles.fillColor = [254, 226, 226];
                data.cell.styles.textColor = [153, 27, 27];
              } else {
                data.cell.styles.fillColor = [254, 243, 199];
                data.cell.styles.textColor = [146, 64, 14];
              }
            }

            const dateFieldsMap: Record<number, string | undefined> = {
              4: v.citv_vencimiento,
              5: v.soat_vencimiento,
              6: v.poliza_vencimiento,
              7: v.contrato_alquiler_vencimiento
            };

            if (colIndex in dateFieldsMap) {
              const val = dateFieldsMap[colIndex];
              if (val) {
                const daysLeft = getDaysUntil(val);
                if (daysLeft <= 0) {
                  data.cell.styles.fillColor = [254, 202, 202];
                  data.cell.styles.textColor = [153, 0, 0];
                  data.cell.styles.fontStyle = 'bold';
                } else if (daysLeft <= 30) {
                  data.cell.styles.fillColor = [253, 224, 71];
                  data.cell.styles.textColor = [133, 77, 14];
                  data.cell.styles.fontStyle = 'bold';
                }
              }
            }
          }
        },
        didDrawPage: () => {
          // Redibujar encabezado en TODAS las páginas
          drawHeader('REPORTE GENERAL DE FLOTA VEHICULAR');
        }
      });

      doc.save(`Reporte Flota Vehicular.pdf`);
    } catch (e) {
      console.error(e);
    }
  };

  const statusColors: Record<string, string> = {
    activa: 'text-slate-500',
    inactiva: 'text-slate-500',
    en_proceso: 'text-slate-500',
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      <div className="p-6 space-y-6 flex-1 overflow-y-auto">
        <ActionToolbar
          totalItems={filteredVehiculos.length}
          label="Unidades"
          searchComponent={
            <>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-[#002855] transition-colors" size={16} />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                className="w-full pl-12 pr-4 py-3 text-[12px] text-[#002855] bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#002855]/30 focus:ring-4 focus:ring-[#002855]/5 outline-none transition-all placeholder:text-slate-300 uppercase tracking-[0.1em]"
              />
            </>
          }
        >
          <FilterBar
            filters={[
              {
                key: 'business_type',
                placeholder: 'TODOS LOS RUBROS',
                icon: Filter,
                iconClassName: 'text-blue-500',
                wrapperClassName: 'md:min-w-[220px]',
                options: Object.entries(BUSINESS_TYPE_LABELS).map(([value, label]) => ({ value, label }))
              },
              {
                key: 'location',
                placeholder: 'TODAS LAS SEDES',
                icon: MapPin,
                iconClassName: 'text-rose-500',
                wrapperClassName: 'md:min-w-[240px]',
                options: filteredSchools.map(loc => ({
                  value: loc.id,
                  label: loc.companies?.name ? `${loc.name} (${loc.companies.name})` : loc.name
                }))
              },
              {
                key: 'estado', placeholder: 'TODOS LOS ESTADOS', options: [
                  { value: 'activa', label: 'Activa' },
                  { value: 'inactiva', label: 'Inactiva' },
                  { value: 'en_proceso', label: 'En Proceso' },
                ]
              },
              {
                key: 'categoria',
                placeholder: 'TODAS LAS CATEGORÍAS',
                icon: Car,
                iconClassName: 'text-indigo-500',
                wrapperClassName: 'md:min-w-[220px]',
                options: categoriasDisponibles.map(cat => ({ value: cat, label: cat })),
              },
            ]}
            values={{ business_type: selectedRubros, location: selectedLocations, estado: filterEstado, categoria: filterCategoria }}
            onChange={(key, value) => {
              if (key === 'business_type') {
                const newRubros = value as string[];
                setSelectedRubros(newRubros);
                if (newRubros.length > 0) {
                  const validIds = new Set(schools.filter(s => s.business_type && newRubros.includes(s.business_type)).map(s => s.id));
                  setSelectedLocations(selectedLocations.filter(id => validIds.has(id)));
                }
              } else if (key === 'location') {
                setSelectedLocations(value as string[]);
              } else if (key === 'estado') {
                setFilterEstado(value as string[]);
              } else if (key === 'categoria') {
                setFilterCategoria(value as string[]);
              }
              setCurrentPage(1);
            }}
            onClearAll={() => {
              setSelectedRubros([]);
              setSelectedLocations([]);
              setFilterEstado([]);
              setFilterCategoria([]);
              setCurrentPage(1);
            }}
          />

          <ViewToggle viewMode={viewMode} onChange={setViewMode} />

          {canEdit() && (
            <button
              onClick={() => { setEditing(undefined); setView(view === 'form' ? 'list' : 'form'); }}
              className={`w-full md:w-auto flex items-center justify-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${view === 'form' ? 'bg-slate-800 text-white' : 'bg-[#002855] text-white hover:bg-blue-800'}`}
            >
              {view === 'form' ? <List size={14} /> : <Plus size={14} />}
              {view === 'form' ? 'Ver Lista' : 'Nueva Unidad'}
            </button>
          )}

          <ActionsDropdown
            selectionMode={
              canEdit()
                ? {
                  active: selectionMode,
                  onToggle: handleToggleSelectionMode,
                  selectedCount: selectedIds.length,
                }
                : undefined
            }
            onExportExcel={handleExportExcel}
            onExportPDF={handleExportPdf}
            extraActions={[
              {
                label: 'Vencimientos (Excel)',
                icon: <RiFileExcel2Fill size={16} className="text-emerald-600" />,
                onClick: handleExportVencimientosExcel,
                badge: getVencimientoReport().length || undefined,
              },
              {
                label: 'Vencimientos (PDF)',
                icon: <FaFilePdf size={16} className="text-rose-500" />,
                onClick: handleExportVencimientosPdf,
                badge: getVencimientoReport().length || undefined,
              },
            ]}
          />

          {canEdit() && selectionMode && selectedIds.length > 0 && viewMode === 'table' && (
            <button
              onClick={handleBulkDelete}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-3 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 hover:text-rose-700 transition-all text-[10px] font-black uppercase tracking-widest shadow-sm"
            >
              <Trash2 size={14} />
              Eliminar ({selectedIds.length})
            </button>
          )}
        </ActionToolbar>

        {view === 'form' ? (
          <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 sm:p-8">
              <div className="mb-8 border-b border-gray-100 pb-6">
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                  {editing ? 'Actualización de Unidad' : 'Registro de Nueva Unidad'}
                </h3>
                <p className="text-sm text-slate-500 mt-1 font-medium italic">Gestione los detalles técnicos y administrativos de la flota vehicular.</p>
              </div>
              <FlotaVehicularForm
                onClose={() => setView('list')}
                onSave={() => { fetchVehiculos(); setView('list'); setEditing(undefined); }}
                editVehicle={editing}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-500">
            {loading ? (
              <LoadingSpinner label="Cargando flota vehicular..." />
            ) : viewMode === 'table' ? (
              <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden flex flex-col animate-in fade-in duration-300">
                <div className="bg-slate-50/50 border-b border-slate-100 shrink-0">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={sortedVehiculos.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={setItemsPerPage}
                  />
                </div>
                {/* Mobile card view */}
                <div className="block md:hidden space-y-3">
                  {paginatedVehiculos.map((v) => (
                    <div
                      key={v.id}
                      className={`bg-white border border-slate-200 p-4 active:bg-slate-50 transition-all cursor-pointer ${selectedIds.includes(v.id) ? 'border-[#002855] bg-[#002855]/5' : ''}`}
                      onClick={() => handleView(v)}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {canEdit() && selectionMode && (
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(v.id)}
                              onChange={() => toggleSelect(v.id)}
                              onClick={e => e.stopPropagation()}
                              className="w-4 h-4 rounded border-slate-300 text-[#002855] focus:ring-[#002855]/30 cursor-pointer shrink-0"
                            />
                          )}
                          <span className="font-mono text-[13px] font-black text-slate-900 tracking-wider">{v.placa}</span>
                        </div>
                        <span className="text-[14px] font-semibold text-slate-800">
                          {v.estado === 'en_proceso' ? 'En Proceso' : v.estado === 'activa' ? 'Activa' : 'Inactiva'}
                        </span>
                      </div>
                      <div className="mb-2">
                        <span className="text-[11px] font-bold text-slate-800">{v.marca} {v.modelo}{v.año ? ` (${v.año})` : ''}</span>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                          <MapPin size={10} className="text-rose-400 shrink-0" />
                          <span className="truncate">{getEscuelaNombre(v.ubicacion_actual)}</span>
                        </div>
                        <div className="mt-1.5">
                          <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-1.5 py-0.5">
                            {v.categoria || 'Sin categoría'}
                          </span>
                        </div>
                        <div className="flex gap-4 mt-2 text-[10px] flex-wrap">
                          <span className="text-slate-400">CITV: <span className="font-semibold text-slate-600">{v.citv_vencimiento ? new Date(v.citv_vencimiento + 'T12:00:00').toLocaleDateString('es-PE') : '—'}</span></span>
                          <span className="text-slate-400">SOAT: <span className="font-semibold text-slate-600">{v.soat_vencimiento ? new Date(v.soat_vencimiento + 'T12:00:00').toLocaleDateString('es-PE') : '—'}</span></span>
                          <span className="text-slate-400">Póliza: <span className="font-semibold text-slate-600">{v.poliza_vencimiento ? new Date(v.poliza_vencimiento + 'T12:00:00').toLocaleDateString('es-PE') : '—'}</span></span>
                        </div>
                      </div>
                      {canEdit() && (
                        <div className="flex gap-1.5 pt-2 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                          <button onClick={() => handleEdit(v)} className="text-[10px] font-bold text-[#002855] hover:underline bg-[#002855]/5 px-2 py-1 rounded-sm w-full text-center" title="Editar Unidad">Editar</button>
                          <button onClick={() => handleDelete(v.id)} className="text-[10px] font-bold text-rose-600 hover:underline bg-rose-50 px-2 py-1 rounded-sm w-full text-center" title="Eliminar Unidad">Eliminar</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {canEdit() && selectionMode && (
                          <TableHead className="w-12 text-center">
                            <input
                              type="checkbox"
                              checked={paginatedVehiculos.length > 0 && selectedIds.length === paginatedVehiculos.length}
                              onChange={() => toggleSelectAll(paginatedVehiculos)}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-[#002855] focus:ring-[#002855]/30 transition-all cursor-pointer"
                            />
                          </TableHead>
                        )}
                        <TableHead sortable isSorted={sortConfig?.key === 'placa'} sortDirection={sortConfig?.direction || 'asc'} onClick={() => handleSort('placa')}>Placa</TableHead>

                        <TableHead sortable isSorted={sortConfig?.key === 'categoria'} sortDirection={sortConfig?.direction || 'asc'} onClick={() => handleSort('categoria')}>Categoría</TableHead>
                        <TableHead sortable isSorted={sortConfig?.key === 'ubicacion_actual'} sortDirection={sortConfig?.direction || 'asc'} onClick={() => handleSort('ubicacion_actual')}>Ubicación</TableHead>
                        <TableHead sortable isSorted={sortConfig?.key === 'citv_vencimiento'} sortDirection={sortConfig?.direction || 'asc'} onClick={() => handleSort('citv_vencimiento')}>CITV (Vence)</TableHead>
                        <TableHead sortable isSorted={sortConfig?.key === 'soat_vencimiento'} sortDirection={sortConfig?.direction || 'asc'} onClick={() => handleSort('soat_vencimiento')}>SOAT (Vence)</TableHead>
                        <TableHead sortable isSorted={sortConfig?.key === 'poliza_vencimiento'} sortDirection={sortConfig?.direction || 'asc'} onClick={() => handleSort('poliza_vencimiento')}>Póliza (Vence)</TableHead>
                        <TableHead className="text-center">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedVehiculos.map((v) => (
                        <TableRow
                          key={v.id}
                          className={`cursor-pointer transition-colors duration-150 group relative ${selectedIds.includes(v.id) ? 'bg-blue-50/40' : ''}`}
                          onClick={() => handleView(v)}
                        >
                          {canEdit() && selectionMode && (
                            <TableCell className="text-center w-12">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(v.id)}
                                onChange={() => toggleSelect(v.id)}
                                onClick={e => e.stopPropagation()}
                                className="w-3.5 h-3.5 rounded border-slate-300 text-[#002855] focus:ring-[#002855]/30 transition-all cursor-pointer"
                              />
                            </TableCell>
                          )}
                          <TableCell className="font-bold">
                            <div className="flex items-center gap-4">
                              {renderPlacaBadge(v.placa)}
                              <div className="flex flex-col">
                                <span className="text-[13px] font-black text-slate-800 leading-none">{v.marca}</span>
                                <span className="text-[11px] font-semibold text-slate-400 tracking-wider mt-1">{v.modelo} {v.año ? `(${v.año})` : ''}</span>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <span className="text-[12px] font-semibold text-slate-600">{v.categoria || '—'}</span>
                          </TableCell>

                          <TableCell>
                            <div className="flex flex-col min-w-0">
                              <TableCellPrimary className="truncate max-w-[180px]">{getEscuelaNombre(v.ubicacion_actual)}</TableCellPrimary>
                            </div>
                          </TableCell>
                          <TableCell>
                            {renderDocumentStatus(v.citv_vencimiento)}
                          </TableCell>
                          <TableCell>
                            {renderDocumentStatus(v.soat_vencimiento)}
                          </TableCell>
                          <TableCell>
                            {renderDocumentStatus(v.poliza_vencimiento)}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-150" onClick={(e) => e.stopPropagation()}>
                              {canEdit() && (
                                <>
                                  <button
                                    onClick={() => handleEdit(v)}
                                    className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-[#002855] hover:bg-slate-100 bg-white rounded-lg border border-slate-200 transition-all shadow-sm"
                                    title="Editar Unidad"
                                  >
                                    <Edit size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(v.id)}
                                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 bg-white rounded-lg border border-slate-200 transition-all shadow-sm"
                                    title="Eliminar Unidad"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={sortedVehiculos.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={setItemsPerPage}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {paginatedVehiculos.map(v => (
                    <div key={v.id} className={`bg-white rounded-2xl shadow-sm border transition-all p-6 flex flex-col group overflow-hidden hover:-translate-y-0.5 duration-200 relative ${selectedIds.includes(v.id) ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10' : 'border-slate-200/80 hover:shadow-xl'}`}>
                      {canEdit() && selectionMode && (
                        <div className="absolute top-4 right-4 z-10">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(v.id)}
                            onChange={() => toggleSelect(v.id)}
                            onClick={e => e.stopPropagation()}
                            className="w-4 h-4 rounded border-slate-300 text-[#002855] focus:ring-[#002855]/30 cursor-pointer shadow-sm"
                          />
                        </div>
                      )}
                      <div className="flex justify-between items-center mb-5">
                        {renderPlacaBadge(v.placa)}
                        <span className={`text-[10px] font-semibold ${statusColors[v.estado]}`}>
                          {v.estado === 'en_proceso' ? 'En Proceso' : v.estado === 'activa' ? 'Activa' : 'Inactiva'}
                        </span>
                      </div>

                      <div className="mb-4">
                        <h4 className="text-[14px] font-black text-slate-800 leading-none">{v.marca}</h4>
                        <p className="text-[11px] font-semibold text-slate-400 tracking-wider mt-1">{v.modelo} {v.año ? `(${v.año})` : ''}</p>
                        <span className="inline-block mt-2 text-[9px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-1.5 py-0.5">
                          {v.categoria || 'Sin categoría'}
                        </span>
                      </div>

                      <div className="space-y-4 mb-6">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                          <MapPin size={14} className="text-rose-500 shrink-0" />
                          <span className="truncate">{getEscuelaNombre(v.ubicacion_actual)}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100 flex flex-col gap-1">
                            <label className="text-[8px] font-black text-slate-400 tracking-widest block">CITV</label>
                            {renderDocumentStatus(v.citv_vencimiento)}
                          </div>
                          <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100 flex flex-col gap-1">
                            <label className="text-[8px] font-black text-slate-400 tracking-widest block">SOAT</label>
                            {renderDocumentStatus(v.soat_vencimiento)}
                          </div>
                          <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100 flex flex-col gap-1">
                            <label className="text-[8px] font-black text-slate-400 tracking-widest block">PÓLIZA</label>
                            {renderDocumentStatus(v.poliza_vencimiento)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-auto flex gap-2 pt-4 border-t border-slate-50">
                        {canEdit() && (
                          <>
                            <button onClick={() => handleEdit(v)} className="p-2 text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-800 hover:text-white transition-all shadow-sm"><Edit size={16} /></button>
                            <button onClick={() => handleDelete(v.id)} className="p-2 text-rose-500 border border-rose-100 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm"><Trash2 size={16} /></button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!loading && sortedVehiculos.length === 0 && (
              <div className="text-left py-12">
                <p className="text-gray-500 font-medium">No se encontraron unidades registradas.</p>
              </div>
            )}
          </div>
        )}
      </div>
      {showDetails && selectedVehiculo && (() => {
        const fmtLocal = (f?: string) => f ? new Date(String(f + 'T00:00:00').includes('T') ? String(f + 'T00:00:00') : `${f + 'T00:00:00'}T12:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : null;
        const docCard = (title: string, vencimiento?: string) => {
          const daysLeft = vencimiento ? getDaysUntil(vencimiento) : null;
          const borderColor = daysLeft === null ? 'border-slate-200' : daysLeft <= 0 ? 'border-rose-300' : daysLeft <= 30 ? 'border-amber-300' : 'border-emerald-200';
          const headerBg = daysLeft === null ? 'bg-slate-100' : daysLeft <= 0 ? 'bg-rose-50' : daysLeft <= 30 ? 'bg-amber-50' : 'bg-emerald-50';
          return (
            <div className={`border ${borderColor} bg-white overflow-hidden`}>
              <div className={`${headerBg} px-3 py-2 flex items-center justify-between border-b ${borderColor}`}>
                <span className="text-[9px] sm:text-[10px] font-normal text-[#002855] tracking-widest">{title}</span>
                {daysLeft !== null && renderDocumentStatus(vencimiento)}
              </div>
              <div className="px-3 py-2.5">
                <div>
                  <span className="text-[8px] font-normal text-slate-400 tracking-widest block mb-1">Vencimiento</span>
                  <span className="text-[10px] sm:text-[11px] font-normal text-slate-700">{fmtLocal(vencimiento) || '—'}</span>
                </div>
              </div>
            </div>
          );
        };
        return (
          <DetailModal maxWidth="5xl" onClose={() => setShowDetails(false)} closeOnBackdrop>
            <DetailModalHeader>
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
              <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1 pr-1">
                <div className="w-9 h-9 sm:w-11 sm:h-11 shrink-0 bg-white/10 border border-white/20 flex items-center justify-center text-white">
                  <Car size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xs sm:text-base md:text-[18px] font-normal text-white tracking-tight leading-snug line-clamp-2 sm:line-clamp-1">
                    {selectedVehiculo.marca} {selectedVehiculo.modelo} {selectedVehiculo.año ? `(${selectedVehiculo.año})` : ''}
                  </h2>
                  <p className="text-[9px] sm:text-[10px] font-normal text-blue-200 tracking-wide mt-1 flex items-start sm:items-center gap-1.5">
                    <MapPin size={10} className="shrink-0 mt-0.5 sm:mt-0" />
                    <span className="line-clamp-2 sm:truncate">{getEscuelaNombre(selectedVehiculo.ubicacion_actual)}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {renderPlacaBadge(selectedVehiculo.placa)}
              </div>
              <button
                onClick={() => setShowDetails(false)}
                className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 text-white/50 hover:text-white hover:bg-white/10 transition-all -mr-1"
                aria-label="Cerrar detalle"
              >
                <X size={22} />
              </button>
            </DetailModalHeader>

            <DetailModalBody>
              {/* Quick info strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-200 border-b border-slate-200">
                <div className="bg-white p-3 sm:p-4 flex flex-col items-center justify-center text-center">
                  <span className="text-[8px] font-normal text-slate-400 tracking-widest mb-1">Estado</span>
                  <span className={`text-[11px] font-semibold ${statusColors[selectedVehiculo.estado]}`}>
                    {selectedVehiculo.estado === 'en_proceso' ? 'En Proceso' : selectedVehiculo.estado === 'activa' ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
                <div className="bg-white p-3 sm:p-4 flex flex-col items-center justify-center text-center">
                  <span className="text-[8px] font-normal text-slate-400 tracking-widest mb-1">Categoría</span>
                  <span className="text-[10px] sm:text-[11px] font-normal text-[#002855]">{selectedVehiculo.categoria || '—'}</span>
                </div>
                <div className="bg-white p-3 sm:p-4 flex flex-col items-center justify-center text-center">
                  <span className="text-[8px] font-normal text-slate-400 tracking-widest mb-1">Marca / Modelo</span>
                  <span className="text-[10px] sm:text-[11px] font-normal text-[#002855] leading-tight">{selectedVehiculo.marca} {selectedVehiculo.modelo}</span>
                </div>
                <div className="bg-white p-3 sm:p-4 flex flex-col items-center justify-center text-center">
                  <span className="text-[8px] font-normal text-slate-400 tracking-widest mb-1">Color / Año</span>
                  <span className="text-[10px] sm:text-[11px] font-normal text-[#002855]">{selectedVehiculo.color || '—'} / {selectedVehiculo.año || '—'}</span>
                </div>
              </div>

              {/* Documents section */}
              <div className="py-4 sm:py-6 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar size={14} className="text-[#002855]" />
                  <span className="text-[10px] sm:text-[11px] font-normal text-[#002855] tracking-[0.15em]">Documentación Vehicular</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {docCard('CITV', selectedVehiculo.citv_vencimiento)}
                  {docCard('SOAT', selectedVehiculo.soat_vencimiento)}
                  {docCard('Póliza de Seguros', selectedVehiculo.poliza_vencimiento)}
                  {docCard('Contrato de Alquiler', selectedVehiculo.contrato_alquiler_vencimiento)}
                </div>

                {selectedVehiculo.notas && (
                  <div className="p-3 sm:p-4 bg-amber-50 border border-amber-100 mt-2">
                    <span className="text-[8px] sm:text-[9px] font-normal text-amber-600 tracking-widest mb-1.5 flex items-center gap-1.5">
                      📝 Notas / Observaciones
                    </span>
                    <p className="text-[10px] sm:text-[11px] font-medium text-amber-900 leading-relaxed">
                      {selectedVehiculo.notas}
                    </p>
                  </div>
                )}
              </div>
            </DetailModalBody>

            <StandardModalFooter
              onClose={() => setShowDetails(false)}
              onEdit={canEdit() ? () => { setShowDetails(false); handleEdit(selectedVehiculo); } : undefined}
              editLabel="Editar"
            />
          </DetailModal>
        );
      })()}

      <VehicleImportModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} onSuccess={fetchVehiculos} locations={schools} />
    </div>
  );
}
