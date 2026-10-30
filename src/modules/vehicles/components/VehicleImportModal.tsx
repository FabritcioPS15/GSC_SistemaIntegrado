import { useState, useRef, useMemo } from 'react';
import { X, FileSpreadsheet, AlertCircle, CheckCircle, Truck } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../../shared/services/supabase';
import { useNotify } from '../../../shared/hooks/useNotify';
import ModalOverlay from '../../../shared/components/ui/ModalOverlay';
import Loader from '../../../shared/components/ui/Loader';

type VehicleImportModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    locations: { id: string; name: string }[];
};

type RawSheet = {
    name: string;
    data: any[];
};

type SheetMapping = {
    sheetName: string;
    locationId: string; // empty string if not mapped
    ignore: boolean;
};

// Mapeo inicial de sedes (variaciones comunes -> nombre exacto de BD)
// Reutilizamos la lógica del inventario pero adaptado si es necesario
const INITIAL_LOCATION_MAPPING: Record<string, string> = {
    'OFICINA': 'Oficina Principal',
    'CHINCHA': 'Chincha',
    'PISCO': 'Pisco',
    'ICA': 'Ica',
    'SCP ICA': 'San Cristobal del Peru Ica',
    'SCP AND': 'San Cristobal del Peru Andahuaylas',
    'SCP AQP': 'Arequipa',
    'SCP CUS': 'Cusco',
    'SCP TRU': 'Trujillo',
    'SCP CHIC': 'Chiclayo',
    'SCP PIU': 'Piura',
    'SCP HYO': 'Huancayo',
};

export default function VehicleImportModal({ isOpen, onClose, onSuccess, locations }: VehicleImportModalProps) {
    const { error: notifyError } = useNotify();
    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [rawSheets, setRawSheets] = useState<RawSheet[]>([]);
    const [mappings, setMappings] = useState<SheetMapping[]>([]);
    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Helper para parsear fechas de Excel
    const parseExcelDate = (value: any): string | null => {
        if (!value) return null;
        try {
            // Si es un número (formato fecha Excel)
            if (typeof value === 'number') {
                const date = XLSX.SSF.parse_date_code(value);
                // Asegurar formato YYYY-MM-DD
                return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
            }
            // Si es texto, intentamos parsear directo si viene como YYYY-MM-DD o DD/MM/YYYY
            const strVal = String(value).trim();
            if (strVal.match(/^\d{4}-\d{2}-\d{2}$/)) return strVal;
            // Si viene DD/MM/YYYY
            if (strVal.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                const [d, m, y] = strVal.split('/');
                return `${y}-${m}-${d}`;
            }
        } catch (e) {
            console.warn('Error parsing date:', value);
        }
        return null; // Fallback
    };

    const preview = useMemo(() => {
        if (!rawSheets.length) return null;

        let totalRecords = 0;
        let validRecords = 0;
        let invalidRecords = 0;
        const errors: string[] = [];
        const processedRecords: any[] = [];

        rawSheets.forEach(sheet => {
            const mapping = mappings.find(m => m.sheetName === sheet.name);
            if (!mapping || mapping.ignore) return;

            const locationId = mapping.locationId;

            sheet.data.forEach((row) => {
                totalRecords++;

                if (!locationId) {
                    invalidRecords++;
                    return;
                }

                // Normalizar keys
                const normalizedRow: any = {};
                Object.keys(row).forEach(key => {
                    normalizedRow[key.toUpperCase().trim()] = row[key];
                });

                // Validaciones mínimas
                const placa = normalizedRow['PLACA'];
                const marca = normalizedRow['MARCA'];
                const modelo = normalizedRow['MODELO'];

                if (!placa || !marca) {
                    invalidRecords++;
                    const msg = `Fila sin Placa o Marca en hoja '${sheet.name}'`;
                    if (!errors.includes(msg) && errors.length < 5) errors.push(msg);
                    return;
                }

                validRecords++;

                processedRecords.push({
                    placa: String(placa).toUpperCase().trim(),
                    marca: String(marca).trim(),
                    modelo: String(modelo || 'Genérico').trim(),
                    categoria: normalizedRow['CATEGORIA'] || normalizedRow['CATEGORÍA'] || null,
                    año: normalizedRow['AÑO'] ? Number(normalizedRow['AÑO']) : new Date().getFullYear(),
                    tipo_combustible: (normalizedRow['COMBUSTIBLE'] || 'gasolina').toLowerCase(), // gasolina, diesel, etc
                    kilometraje: Number(normalizedRow['KILOMETRAJE'] || 0),
                    estado: 'activa', // Default state
                    ubicacion_actual: locationId,
                    imagen_url: '',
                    fecha_ultimo_mantenimiento: new Date().toISOString().split('T')[0], // Default today
                    notas: normalizedRow['NOTAS'] || '',
                    // Dates
                    citv_emision: parseExcelDate(normalizedRow['CITV EMISION']),
                    citv_vencimiento: parseExcelDate(normalizedRow['CITV VENCIMIENTO']),
                    soat_emision: parseExcelDate(normalizedRow['SOAT EMISION']),
                    soat_vencimiento: parseExcelDate(normalizedRow['SOAT VENCIMIENTO']),
                    poliza_emision: parseExcelDate(normalizedRow['POLIZA EMISION']),
                    poliza_vencimiento: parseExcelDate(normalizedRow['POLIZA VENCIMIENTO']),
                    contrato_alquiler_emision: parseExcelDate(normalizedRow['ALQUILER EMISION']),
                    contrato_alquiler_vencimiento: parseExcelDate(normalizedRow['ALQUILER VENCIMIENTO']),
                    updated_at: new Date().toISOString()
                });
            });
        });

        return {
            totalSheets: rawSheets.length,
            totalRecords,
            validRecords,
            invalidRecords,
            errors,
            processedRecords
        };

    }, [rawSheets, mappings]);

    if (!isOpen) return null;

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
            handleFileSelect(droppedFile);
        } else {
            notifyError('Por favor, sube un archivo Excel válido (.xlsx o .xls)');
        }
    };

    const guessLocation = (sheetName: string) => {
        const normalizedSheetName = sheetName.trim().toUpperCase();

        let exactMatch = locations.find(l => {
            const locName = l.name.toUpperCase();
            return locName === normalizedSheetName ||
                normalizedSheetName.includes(locName) ||
                locName.includes(normalizedSheetName);
        });
        if (exactMatch) return exactMatch.id;

        const mappedKey = Object.keys(INITIAL_LOCATION_MAPPING).find(key => normalizedSheetName.includes(key));
        if (mappedKey) {
            const targetName = INITIAL_LOCATION_MAPPING[mappedKey].toUpperCase();
            const mappedMatch = locations.find(l => {
                const locName = l.name.toUpperCase();
                return locName === targetName || locName.includes(targetName) || targetName.includes(locName);
            });
            if (mappedMatch) return mappedMatch.id;
        }

        return '';
    };

    const handleFileSelect = async (selectedFile: File) => {
        setFile(selectedFile);
        setRawSheets([]);
        setMappings([]);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });

                const loadedSheets: RawSheet[] = [];
                const initialMappings: SheetMapping[] = [];

                workbook.SheetNames.forEach(sheetName => {
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

                    if (jsonData.length > 0) {
                        loadedSheets.push({
                            name: sheetName,
                            data: jsonData
                        });

                        initialMappings.push({
                            sheetName: sheetName,
                            locationId: guessLocation(sheetName),
                            ignore: false
                        });
                    }
                });

                setRawSheets(loadedSheets);
                setMappings(initialMappings);

            } catch (error) {
                console.error('Error parsing excel:', error);
                notifyError('Error al leer el archivo Excel.');
            }
        };
        reader.readAsBinaryString(selectedFile);
    };

    const handleMappingChange = (sheetName: string, newLocationId: string) => {
        setMappings(prev => prev.map(m =>
            m.sheetName === sheetName ? { ...m, locationId: newLocationId } : m
        ));
    };

    const handleToggleIgnore = (sheetName: string) => {
        setMappings(prev => prev.map(m =>
            m.sheetName === sheetName ? { ...m, ignore: !m.ignore } : m
        ));
    };

    const handleImport = async () => {
        if (!preview || !preview.processedRecords.length) return;
        setImporting(true);

        try {
            const batchSize = 50;
            const records = preview.processedRecords;
            for (let i = 0; i < records.length; i += batchSize) {
                const batch = records.slice(i, i + batchSize);
                const { error } = await supabase.from('vehiculos').insert(batch);
                if (error) throw error;
            }

            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Import error:', error);
            notifyError('Error al importar datos: ' + error.message);
        } finally {
            setImporting(false);
        }
    };

    return (
        <ModalOverlay className="bg-slate-900/40 backdrop-blur-sm">
            <div
                className="bg-white w-full h-full md:h-[90vh] max-w-full sm:max-w-4xl rounded-none shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-900 to-blue-900 px-5 py-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-6">
                        <div className="w-9 h-9 bg-white/10 rounded-none flex items-center justify-center border border-white/20">
                            <Truck size={18} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-normal text-white tracking-[0.2em] leading-tight">Importar Flota Vehicular</h2>
                            <p className="text-[10px] font-normal text-blue-200 tracking-widest mt-0.5">Mapear manualmente las hojas a las sedes/escuelas</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-none transition-all">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 bg-gray-50/50">
                    {!file ? (
                        <div
                            className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center transition-all cursor-pointer bg-white ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                                }`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <div className="bg-green-100 p-4 rounded-full mb-4">
                                <FileSpreadsheet className="text-green-600" size={32} />
                            </div>
                            <h4 className="text-lg font-medium text-slate-700 mb-2">
                                Arrastra tu archivo Excel aquí
                            </h4>
                            <p className="text-xs text-slate-400 mb-4 max-w-sm">
                                Columnas requeridas: PLACA, MARCA, MODELO.
                                Opcionales: AÑO, KILOMETRAJE, COMBUSTIBLE, CITV VENCIMIENTO, SOAT VENCIMIENTO, POLIZA VENCIMIENTO, ALQUILER VENCIMIENTO.
                            </p>
                            <button className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors font-medium text-sm">
                                Seleccionar Archivo
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx, .xls"
                                className="hidden"
                                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                            />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* File Info & Summary */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="md:col-span-4 flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-green-100 p-2 rounded-lg">
                                            <FileSpreadsheet className="text-green-600" size={20} />
                                        </div>
                                        <span className="font-medium text-slate-800">{file.name}</span>
                                    </div>
                                    <button
                                        onClick={() => setFile(null)}
                                        className="text-slate-400 hover:text-red-500 text-sm font-medium"
                                    >
                                        Cambiar
                                    </button>
                                </div>

                                {/* Stats */}
                                {preview && (
                                    <>
                                        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm border-l-4 border-l-blue-500">
                                            <div className="text-2xl font-normal text-blue-600">{preview.totalRecords}</div>
                                            <div className="text-xs text-slate-500 font-normal">Vehículos</div>
                                        </div>
                                        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm border-l-4 border-l-green-500">
                                            <div className="text-2xl font-normal text-green-600">{preview.validRecords}</div>
                                            <div className="text-xs text-slate-500 font-normal">Listos</div>
                                        </div>
                                        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm border-l-4 border-l-red-500">
                                            <div className="text-2xl font-normal text-red-600">{preview.invalidRecords}</div>
                                            <div className="text-xs text-slate-500 font-normal">Errores</div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* MAPPING TABLE */}
                            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                                <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex justify-between items-center">
                                    <h5 className="font-normal text-slate-700 text-sm tracking-wide">Mapeo de Sedes por Hoja</h5>
                                    <span className="text-xs text-slate-500">Cada hoja debería ser una sede/escuela</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="gsc-table w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 text-xs font-normal">
                                            <tr>
                                                <th className="px-6 py-3">Hoja (Excel)</th>
                                                <th className="px-6 py-3">Registros</th>
                                                <th className="px-6 py-3">Sede destino</th>
                                                <th className="px-6 py-3 text-center">Estado</th>
                                                <th className="px-6 py-3 text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {mappings.map((mapping, idx) => {
                                                const sheetStat = rawSheets.find(s => s.name === mapping.sheetName);
                                                const recordCount = sheetStat?.data.length || 0;
                                                const isMapped = !!mapping.locationId;

                                                return (
                                                    <tr key={idx} className={`hover:bg-slate-50 transition-colors ${mapping.ignore ? 'opacity-50' : ''}`}>
                                                        <td className="px-6 py-3 font-medium text-slate-800">
                                                            {mapping.sheetName}
                                                        </td>
                                                        <td className="px-6 py-3 text-slate-600">
                                                            {recordCount}
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            <select
                                                                value={mapping.locationId}
                                                                onChange={(e) => handleMappingChange(mapping.sheetName, e.target.value)}
                                                                disabled={mapping.ignore}
                                                                className={`w-full max-w-xs px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${!isMapped && !mapping.ignore ? 'border-red-300 bg-red-50 text-red-900' : 'border-slate-200'
                                                                    }`}
                                                            >
                                                                <option value="">-- Seleccionar Sede --</option>
                                                                {locations.map(loc => (
                                                                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td className="px-6 py-3 text-center">
                                                            {mapping.ignore ? (
                                                                <span className="text-xs font-medium text-slate-500">
                                                                    Ignorado
                                                                </span>
                                                            ) : isMapped ? (
                                                                <span className="text-xs font-medium text-slate-500">
                                                                    <CheckCircle size={12} /> Listo
                                                                </span>
                                                            ) : (
                                                                <span className="text-xs font-medium text-slate-500">
                                                                    <AlertCircle size={12} /> Pendiente
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-3 text-right">
                                                            <button
                                                                onClick={() => handleToggleIgnore(mapping.sheetName)}
                                                                className="text-xs font-medium text-slate-500 hover:text-slate-800 underline"
                                                            >
                                                                {mapping.ignore ? 'Habilitar' : 'Ignorar'}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Validation Errors */}
                            {preview && preview.errors.length > 0 && (
                                <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                                    <h5 className="text-red-800 font-medium text-sm mb-2 flex items-center gap-2">
                                        <AlertCircle size={14} /> Alertas de validación
                                    </h5>
                                    <ul className="list-disc list-inside text-xs text-red-600">
                                        {preview.errors.slice(0, 3).map((err, i) => (
                                            <li key={i}>{err}</li>
                                        ))}
                                        {preview.errors.length > 3 && <li>...y {preview.errors.length - 3} más</li>}
                                    </ul>
                                </div>
                            )}

                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-white border-t px-4 py-3 flex items-center justify-between gap-3 z-10">
                    <div className="text-[10px] font-normal text-slate-400 tracking-widest">
                        {preview ? `${preview.validRecords} vehículos listos de ${preview.totalRecords} totales` : 'Esperando archivo...'}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            disabled={importing}
                            className="px-6 py-2 text-[10px] font-normal tracking-[0.2em] text-slate-600 bg-white border border-slate-200 rounded-none hover:bg-slate-50 transition-all disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleImport}
                            disabled={!file || !preview || preview.validRecords === 0 || importing}
                            className="px-8 py-2 text-[10px] font-normal tracking-[0.2em] text-white bg-blue-600 rounded-none hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg disabled:cursor-not-allowed"
                        >
                            {importing && <Loader size={14} />}
                            {importing ? 'Importando...' : `Importar ${preview?.validRecords || 0} Vehículos`}
                        </button>
                    </div>
                </div>
            </div>
        </ModalOverlay>
    );
}
