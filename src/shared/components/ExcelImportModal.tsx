import { useState, useRef, useMemo, useEffect } from 'react';
import { X, FileSpreadsheet, AlertCircle, CheckCircle, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase, AssetType, Location, Category, Subcategory } from '../services/supabase';
import { useNotify } from '../hooks/useNotify';
import { generateAndDownloadTemplate } from '../utils/excelTemplate';
import ModalOverlay from './ui/ModalOverlay';
import Loader from './ui/Loader';

type ExcelImportModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    assetTypes: AssetType[];
    locations: Location[];
};

type RawSheet = {
    name: string;
    data: any[];
};

type SheetMapping = {
    sheetName: string;
    locationId: string; // empty string if not mapped
    categoryId: string; // empty string if not overriding
    ignore: boolean;
};

// Mapeo detallado de tipos de activos (variaciones comunes -> nombre exacto de BD)
// Palabras clave que deben estar presentes (no usar coincidencias parciales para evitar falsos positivos)
const ASSET_TYPE_KEYWORDS: Record<string, string> = {
    // Monitor - debe estar ANTES que otras búsquedas para evitar conflictos
    'MONITOR': 'Monitor',
    'MONITORES': 'Monitor',
    'MONITO': 'Monitor',
    'PANTALLA': 'Monitor',
    'PANTALLAS': 'Monitor',
    'PANTALLAS PARA PC': 'Monitor',
    'DISPLAY': 'Monitor',
    // Equipos de Línea variantes (antes "PC")
    'COMPUTADORA': 'EQUIPOS DE LÍNEA',
    'ORDENADOR': 'EQUIPOS DE LÍNEA',
    'DESKTOP': 'EQUIPOS DE LÍNEA',
    'PC ': 'EQUIPOS DE LÍNEA',  // PC con espacio para evitar coincidencias con otros
    'CPU ': 'EQUIPOS DE LÍNEA', // CPU con espacio para evitar coincidencias
    // Laptop variantes
    'PORTATIL': 'Laptop',
    'NOTEBOOK': 'Laptop',
    'LAPTOP': 'Laptop',
    // Celular variantes
    'TELEFONO': 'Celular',
    'SMARTPHONE': 'Celular',
    'MOVIL': 'Celular',
    'CELULAR': 'Celular',
    // Otros comunes
    'IMPRESORA': 'Impresora',
    'SCANNER': 'Escáner',
    'ESCANER': 'Escáner',
    'PROYECTOR': 'Proyector',
    'DATA': 'Proyector',
    'CAMARA': 'Cámara',
    'CÁMARA': 'Cámara',
    'DVR': 'DVR',
    'GRABADOR': 'DVR',
    'SWITCH': 'Switch',
    'FUENTE': 'Fuente de Poder',
    'TECLADO': 'Periféricos',
    'MOUSE': 'Periféricos',
    'MOUSEPAD': 'Periféricos',
    'HERRAMIENTAS': 'Herramientas',
    'HERRAMIENTA': 'Herramientas',
    'ALICATE': 'Herramientas',
    'LLAVE': 'Herramientas',
    'DESTORNILLADOR': 'Herramientas',
    'MARTILLO': 'Herramientas',
    'PINZA': 'Herramientas',
    'TALADRO': 'Herramientas',
    'ESMERIL': 'Herramientas',
    'COMPRESORA': 'Herramientas',
    'SOLDADORA': 'Herramientas',
    'GATA': 'Herramientas',
    // Maquinaria - solo si es explícitamente maquinaria
    'MAQUINARIA': 'Maquinaria',
    'MÁQUINA': 'Maquinaria',
    'EQUIPO PESADO': 'Maquinaria',
    'UPS': 'Estabilizador',
    'ESTABILIZADOR': 'Estabilizador',
    'ESTABILIZADORES': 'Estabilizador',
    'BIOMETRICO': 'Biométrico',
    'BIOMÉTRICO': 'Biométrico',
    'RELOJ': 'Biométrico',
    'MARCADOR': 'Biométrico',
    'SILLA': 'Mobiliario',
    'SILLAS': 'Mobiliario',
    'MESA': 'Mobiliario',
    'ESCRITORIO': 'Mobiliario',
    'ESTANTE': 'Mobiliario',
    'ARMARIO': 'Mobiliario',
    'EXTINTOR': 'Seguridad',
    'SEGURIDAD': 'Seguridad',
    // Otros - por defecto
    'OTROS': 'Otros',
    'OTRO': 'Otros',
    'VARIOS': 'Otros',
};

// Mapeo inicial de sedes (variaciones comunes -> nombre exacto de BD)
const INITIAL_LOCATION_MAPPING: Record<string, string> = {
    'OFICINA': 'Oficina Principal',
    'CHINCH': 'Chincha',
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

const ExcelImportModal: React.FC<ExcelImportModalProps> = ({ isOpen, onClose, onSuccess, assetTypes, locations }) => {
    const { error: notifyError } = useNotify();
    const [file, setFile] = useState<File | null>(null);
    const [rawSheets, setRawSheets] = useState<RawSheet[]>([]);
    const [mappings, setMappings] = useState<SheetMapping[]>([]);
    const [importing, setImporting] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [localAssetTypes, setLocalAssetTypes] = useState<AssetType[]>(assetTypes);

    useEffect(() => {
        const fetchExtra = async () => {
            const { data: catData } = await supabase.from('categories').select('*');
            if (catData) setCategories(catData as Category[]);
            const { data: subData } = await supabase.from('subcategories').select('*');
            if (subData) setSubcategories(subData as Subcategory[]);
            const { data: typeData } = await supabase.from('asset_types').select('*');
            if (typeData) setLocalAssetTypes(typeData as AssetType[]);
        };
        fetchExtra();
    }, []);

    // Función helper para convertir fechas vacías a null
    const parseDateField = (value: any): string | null => {
        if (!value || value === '' || value === null || value === undefined) return null;
        // Si es un número (puede ser año o fecha de Excel)
        if (typeof value === 'number') {
            // Si es un año (ej. 2024)
            if (value >= 1900 && value <= 2100) {
                return `${value}-01-01`;
            }
            // Si es una fecha de Excel (días desde 1900)
            try {
                const excelEpoch = new Date(1899, 11, 30);
                const date = new Date(excelEpoch.getTime() + value * 86400000);
                return date.toISOString().split('T')[0];
            } catch {
                return null;
            }
        }
        // Si es una cadena de fecha
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return null;
            // Si el string es solo un año (ej. "2024")
            if (/^\d{4}$/.test(trimmed)) {
                const yearNum = parseInt(trimmed, 10);
                if (yearNum >= 1900 && yearNum <= 2100) {
                    return `${trimmed}-01-01`;
                }
            }
            // Intentar parsear como fecha
            const parsed = new Date(trimmed);
            if (!isNaN(parsed.getTime())) {
                return parsed.toISOString().split('T')[0];
            }
            return null;
        }
        return null;
    };

    // Función helper para limpiar campos vacíos (convertir a null si es string vacío)
    const cleanField = (value: any): string | null => {
        if (value === null || value === undefined || value === '') return null;
        const str = String(value).trim();
        return str === '' ? null : str;
    };

    // Cálculos derivados del estado actual de mappings y rawSheets
    const preview = useMemo(() => {
        if (!rawSheets.length) return null;

        let totalRecords = 0;
        let validRecords = 0;
        let invalidRecords = 0;
        const errors: string[] = [];
        const processedRecords: any[] = []; // Lista final lista para insertar

        rawSheets.forEach(sheet => {
            const mapping = mappings.find(m => m.sheetName === sheet.name);
            if (!mapping || mapping.ignore) return; // Si se ignora, no suma a nada

            const sheetLocationId = mapping.locationId;

            sheet.data.forEach((row) => {
                totalRecords++;

                // Normalizar keys
                const normalizedRow: any = {};
                Object.keys(row).forEach(key => {
                    normalizedRow[key.toUpperCase().trim()] = row[key];
                });

                let locationId = sheetLocationId;
                if (!locationId) {
                    const rowLocationName = (normalizedRow['UBICACIÓN DEL ACTIVO'] || normalizedRow['UBICACION DEL ACTIVO'] || normalizedRow['SEDE'] || '').toString().trim().toUpperCase();
                    if (rowLocationName) {
                        const locMatch = locations.find(l => l.name.toUpperCase() === rowLocationName || l.name.toUpperCase().includes(rowLocationName) || rowLocationName.includes(l.name.toUpperCase()));
                        if (locMatch) {
                            locationId = locMatch.id;
                        }
                    }
                }

                if (!locationId) {
                    invalidRecords++;
                    return;
                }

                // Detección de Tipo - Mejorada
                const typeRaw = (cleanField(normalizedRow['TIPO DE ITEM'] || normalizedRow['ITEM'] || normalizedRow['TIPO DE ACTIVO'] || normalizedRow['TIPO'] || normalizedRow['CATEGORÍA'] || normalizedRow['CATEGORIA'] || normalizedRow['GRUPO']) || '').toString().trim().toUpperCase();
                let typeId = null;
                let categoryId = null;
                let subcategoryId = null;
                let typeMatch = null;

                // 1. Búsqueda exacta en BD
                typeMatch = localAssetTypes.find(t => t.name.toUpperCase() === typeRaw);

                // 2. Búsqueda por palabras clave (orden de prioridad - buscar coincidencias más específicas primero)
                if (!typeMatch && typeRaw) {
                    // Primero buscar palabras clave específicas que deben evitar falsos positivos
                    // Ordenar por longitud descendente para buscar coincidencias más específicas primero
                    const sortedKeywords = Object.keys(ASSET_TYPE_KEYWORDS).sort((a, b) => {
                        // Priorizar palabras más largas (más específicas)
                        if (b.length !== a.length) return b.length - a.length;
                        // Si tienen la misma longitud, priorizar Monitor, PC, Laptop antes que Maquinaria
                        const priority: Record<string, number> = { 'MONITOR': 100, 'MONITORES': 99, 'MONITO': 98, 'PANTALLA': 97, 'PANTALLAS': 96, 'EQUIPOS DE LÍNEA': 95, 'COMPUTADORA': 94, 'DESKTOP': 93, 'MAQUINARIA': 1 };
                        return (priority[b] || 50) - (priority[a] || 50);
                    });

                    for (const keyword of sortedKeywords) {
                        // Buscar palabra clave completa (no parcial) para evitar falsos positivos
                        // Usar regex para buscar como palabra completa o inicio de palabra
                        const keywordEscaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const regex = new RegExp(`\\b${keywordEscaped}\\b|^${keywordEscaped}`, 'i');

                        if (regex.test(typeRaw) || typeRaw === keyword || typeRaw.startsWith(keyword + ' ')) {
                            const targetTypeName = ASSET_TYPE_KEYWORDS[keyword];
                            typeMatch = localAssetTypes.find(t => t.name.toUpperCase() === targetTypeName.toUpperCase());
                            if (typeMatch) break;
                        }
                    }
                }

                // 3. Si no hay coincidencia, usar "Otros" como fallback
                if (!typeMatch) {
                    typeMatch = localAssetTypes.find(t => t.name.toUpperCase() === 'OTROS');
                    if (!typeMatch && localAssetTypes.length > 0) {
                        typeMatch = localAssetTypes[0];
                    }
                }

                if (typeMatch) typeId = typeMatch.id;

                // Si no hay match en BD pero hay match por keyword, guardamos el nombre para el preview
                let typeName = typeMatch?.name || 'Otros';
                if (!typeMatch && typeRaw) {
                    for (const keyword of Object.keys(ASSET_TYPE_KEYWORDS)) {
                        if (typeRaw.includes(keyword)) {
                            typeName = ASSET_TYPE_KEYWORDS[keyword];
                            break;
                        }
                    }
                }

                // Determinar category_id (buscando coincidencia heurística o desde el excel)
                const excelCategory = cleanField(normalizedRow['CATEGORÍA'] || normalizedRow['CATEGORIA']);
                const targetCatName = excelCategory || (
                    ['EQUIPOS DE LÍNEA', 'Laptop', 'Monitor', 'Impresora', 'Escáner', 'Proyector', 'Switch', 'Periféricos', 'Fuente de Poder', 'DVR', 'Cámara', 'Estabilizador'].includes(typeName) ? 'Equipos de Cómputo y TI' :
                        ['Biométrico'].includes(typeName) ? 'Equipos Biométricos y Control' :
                            ['Mobiliario'].includes(typeName) ? 'Mobiliario' :
                                ['Seguridad'].includes(typeName) ? 'Seguridad' :
                                    ['Herramientas'].includes(typeName) ? 'Herramientas' :
                                        typeName === 'Maquinaria' ? 'Maquinaria' :
                                            typeName === 'Vehículo' ? 'Maquinaria' : 'Otros'
                );

                // Determinar subcategory_id (buscando coincidencia heurística)
                let targetSubName = typeName;
                if (typeName === 'EQUIPOS DE LÍNEA') targetSubName = 'Computadoras (CPU)';
                if (typeName === 'Monitor') targetSubName = 'Monitores';
                if (typeName === 'Periféricos') targetSubName = 'Accesorios TI';
                if (typeName === 'Cámara') targetSubName = 'Cámaras';
                if (typeName === 'Switch') targetSubName = 'Redes (router y DVR)';
                if (typeName === 'DVR') targetSubName = 'Redes (router y DVR)';
                if (typeName === 'Estabilizador') targetSubName = 'Estabilizadores';

                const catMatch = categories.find(c => c.name.toUpperCase().includes(targetCatName.toUpperCase()) || targetCatName.toUpperCase().includes(c.name.toUpperCase()));
                if (catMatch) categoryId = catMatch.id;
                else if (categories.length > 0) categoryId = categories[0].id; // Fallback

                const categoryName = catMatch?.name || (targetCatName === 'Herramientas' ? 'Herramientas' : categories[0]?.name || 'Sin Categoría');

                // Si el usuario seleccionó un grupo/categoría para esta hoja, sobreescribimos
                if (mapping.categoryId) {
                    categoryId = mapping.categoryId;
                }

                // Determinar subcategory_id
                const subCatMatch = subcategories.find(s => s.name.toUpperCase().includes(typeName.toUpperCase()) || typeName.toUpperCase().includes(s.name.toUpperCase()));
                if (subCatMatch) subcategoryId = subCatMatch.id;

                let subcategoryName = subCatMatch?.name || 'Área General';
                if (typeName === 'Herramientas') {
                    const descRaw = (normalizedRow['DESCRIPCIÓN'] || normalizedRow['DESCRIPCION'] || '').toString().toUpperCase();
                    const isElectric = ['ELECTRICO', 'ELECTRICA', 'BATERIA', 'VOLTIOS', 'WATTS', 'MOTOR', 'CABLE', 'ENCHUFE', 'TALADRO', 'ESMERIL', 'SOLDADORA', 'COMPRESORA'].some(term => descRaw.includes(term) || typeRaw.includes(term));
                    subcategoryName = isElectric ? 'Herramienta eléctrica' : 'Herramienta manual';
                }

                // Estado
                const condition = (normalizedRow['CONDICIÓN'] || normalizedRow['ESTADO USO'] || '').toString().toUpperCase();
                let status = 'active';
                if (condition.includes('MALO') || condition.includes('AVERIADO') || condition.includes('DAÑADO') || condition.includes('INOPERATIVO')) {
                    status = 'maintenance';
                } else if (condition.includes('BAJA') || condition.includes('EXTRAIDO') || condition.includes('DESECHO')) {
                    status = 'inactive';
                }

                const isValid = !!typeId && !!locationId;

                if (isValid) {
                    validRecords++;
                    // Generar código único aleatorio si no viene en el Excel
                    const excelCode = cleanField(normalizedRow['CÓDIGO ÚNICO'] || normalizedRow['CODIGO UNICO']);
                    const generatedCode = 'INV-' + Math.random().toString(36).substring(2, 8).toUpperCase() + Date.now().toString(36).slice(-3).toUpperCase();

                    // Crear objeto base del activo
                    const assetRecord: any = {
                        codigo_unico: excelCode || generatedCode,
                        asset_type_id: typeId,
                        category_id: categoryId,
                        subcategory_id: subcategoryId,
                        location_id: locationId,
                        area: cleanField(normalizedRow['UBICACIÓN DEL ACTIVO'] || normalizedRow['DEPARTAMENTO'] || normalizedRow['LOCALIZACIÓN'] || normalizedRow['LOCALIZACION'] || normalizedRow['PISO'] || normalizedRow['OFICINA'] || normalizedRow['SECCIÓN'] || normalizedRow['SECCION']),
                        brand: cleanField(normalizedRow['MARCA']),
                        model: cleanField(normalizedRow['MODELO']),
                        serial_number: cleanField(normalizedRow['SERIE'] || normalizedRow['N° DE SERIE'] || normalizedRow['Nº DE SERIE']),
                        status: status,
                        _typeRaw: typeRaw,
                        _typeName: typeName,
                        _categoryName: categoryName,
                        _subcategoryName: subcategoryName
                    };

                    // Agregar campos del Excel para TODOS los tipos de activos
                    assetRecord.item = cleanField(normalizedRow['ITEM']);
                    assetRecord.descripcion = cleanField(normalizedRow['ACTIVO'] || normalizedRow['ITEM'] || normalizedRow['DESCRIPCIÓN'] || normalizedRow['DESCRIPCION']);
                    assetRecord.cantidad = parseInt(normalizedRow['CANTIDAD'] || normalizedRow['CANT.'] || '1') || 1;
                    assetRecord.condicion = cleanField(normalizedRow['CONDICIÓN'] || normalizedRow['CONDICION']);
                    assetRecord.color = cleanField(normalizedRow['COLOR']);
                    // Convertir fecha vacía a null
                    assetRecord.fecha_adquisicion = parseDateField(normalizedRow['AÑO DE ADQUISICIÓN'] || normalizedRow['AÑO ADQUISICION'] || normalizedRow['FECHA DE ADQUISICIÓN'] || normalizedRow['FECHA ADQUISICION'] || normalizedRow['FECHA_ADQUISICION']);
                    const valorEstimado = parseFloat(normalizedRow['VALOR ESTIMADO'] || normalizedRow['VALOR_ESTIMADO'] || '0') || 0;
                    assetRecord.valor_estimado = valorEstimado > 0 ? valorEstimado : null;
                    assetRecord.estado_uso = cleanField(normalizedRow['ESTADO DE USO'] || normalizedRow['ESTADO USO'] || normalizedRow['ESTADO_USO'] || normalizedRow['ESTADO OPERATIVO']);

                    // Agregar campos específicos para Equipos de Línea/Laptop
                    if (typeName === 'EQUIPOS DE LÍNEA' || typeName === 'Laptop') {
                        assetRecord.processor = cleanField(normalizedRow['PROCESADOR']);
                        assetRecord.ram = cleanField(normalizedRow['RAM'] || normalizedRow['MEMORIA RAM']);
                        assetRecord.operating_system = cleanField(normalizedRow['SISTEMA OPERATIVO'] || normalizedRow['SO']);
                        assetRecord.bios_mode = cleanField(normalizedRow['MODO BIOS'] || normalizedRow['BIOS']);
                        assetRecord.placa = cleanField(normalizedRow['PLACA'] || normalizedRow['CODIGO PLACA']);
                    }

                    // Agregar campos específicos para Cámaras/DVR
                    if (typeName === 'Cámara' || typeName === 'DVR') {
                        assetRecord.name = cleanField(normalizedRow['NOMBRE'] || normalizedRow['NOMBRE DISPOSITIVO']);
                        assetRecord.url = cleanField(normalizedRow['URL'] || normalizedRow['URL ACCESO']);
                        assetRecord.username = cleanField(normalizedRow['USUARIO'] || normalizedRow['USUARIO ACCESO']);
                        assetRecord.password = cleanField(normalizedRow['CONTRASEÑA'] || normalizedRow['PASSWORD']);
                        assetRecord.port = cleanField(normalizedRow['PUERTO'] || normalizedRow['PORT']);
                        assetRecord.access_type = cleanField(normalizedRow['TIPO ACCESO'] || normalizedRow['ACCESS TYPE']) || 'url';
                        assetRecord.auth_code = cleanField(normalizedRow['CODIGO AUTENTICACION'] || normalizedRow['AUTH CODE']);
                    }

                    // Agregar campos específicos para Celulares
                    if (typeName === 'Celular') {
                        assetRecord.imei = cleanField(normalizedRow['IMEI']);
                        assetRecord.operator = cleanField(normalizedRow['OPERADOR'] || normalizedRow['COMPANIA']);
                        assetRecord.data_plan = cleanField(normalizedRow['PLAN DATOS'] || normalizedRow['PLAN DE DATOS']);
                        assetRecord.physical_condition = cleanField(normalizedRow['ESTADO FISICO'] || normalizedRow['CONDICION FISICA']);
                        assetRecord.sistema_operativo = cleanField(normalizedRow['SISTEMA OPERATIVO'] || normalizedRow['SO MOVIL']);
                        assetRecord.version_so = cleanField(normalizedRow['VERSION SO'] || normalizedRow['VERSION SISTEMA']);
                        assetRecord.almacenamiento = cleanField(normalizedRow['ALMACENAMIENTO'] || normalizedRow['MEMORIA INTERNA']);
                        assetRecord.bateria_estado = cleanField(normalizedRow['ESTADO BATERIA'] || normalizedRow['BATERIA']);
                        assetRecord.accesorios = cleanField(normalizedRow['ACCESORIOS']);
                    }

                    // Agregar campos específicos para Impresoras/Escáneres
                    if (typeName === 'Impresora' || typeName === 'Escáner') {
                        assetRecord.tipo_impresion = cleanField(normalizedRow['TIPO IMPRESION'] || normalizedRow['TIPO']);
                        assetRecord.tecnologia_impresion = cleanField(normalizedRow['TECNOLOGIA'] || normalizedRow['TECNOLOGIA IMPRESION']);
                        assetRecord.velocidad_impresion = parseInt(normalizedRow['VELOCIDAD'] || normalizedRow['VELOCIDAD IMPRESION'] || normalizedRow['PPM'] || '0') || null;
                        assetRecord.resolucion = cleanField(normalizedRow['RESOLUCION'] || normalizedRow['DPI']);
                    }

                    // Agregar campos específicos para Monitores/Proyectores
                    if (typeName === 'Monitor' || typeName === 'Proyector') {
                        assetRecord.tamaño_pantalla = cleanField(normalizedRow['TAMAÑO PANTALLA'] || normalizedRow['TAMAÑO'] || normalizedRow['PULGADAS']);
                        assetRecord.resolucion_pantalla = cleanField(normalizedRow['RESOLUCION PANTALLA'] || normalizedRow['RESOLUCION']);
                        assetRecord.tipo_conexion = cleanField(normalizedRow['TIPO CONEXION'] || normalizedRow['CONECTOR'] || normalizedRow['CONEXION']);
                        assetRecord.luminosidad = parseInt(normalizedRow['LUMINOSIDAD'] || normalizedRow['LUMENES'] || '0') || null;
                    }

                    processedRecords.push(assetRecord);
                } else {
                    invalidRecords++;
                    if (!typeId) {
                        const msg = `Tipo '${typeRaw}' no reconocido en hoja '${sheet.name}'`;
                        if (!errors.includes(msg) && errors.length < 5) errors.push(msg);
                    }
                }
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

    }, [rawSheets, mappings, assetTypes, categories, subcategories]);


    if (!isOpen) return null;

    const handleDownloadClick = async () => {
        try {
            await generateAndDownloadTemplate();
        } catch (error) {
            console.error('Error generando plantilla interactiva:', error);
            notifyError('Ocurrió un error generando la plantilla interactiva.');
        }
    };

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

        // 1. Coincidencia directa con sedes BD
        let exactMatch = locations.find(l => {
            const locName = l.name.toUpperCase();
            return locName === normalizedSheetName ||
                normalizedSheetName.includes(locName) ||
                locName.includes(normalizedSheetName);
        });
        if (exactMatch) return exactMatch.id;

        // 2. Mapeo Manual Inicial
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
                    // Ignorar la hoja de validaciones generada por la plantilla
                    if (sheetName.toUpperCase() === 'VALIDACIONES') return;

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
                            categoryId: '',
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

    const handleMappingChange = (sheetName: string, field: 'locationId' | 'categoryId', value: string) => {
        setMappings(prev => prev.map(m =>
            m.sheetName === sheetName ? { ...m, [field]: value } : m
        ));
    };

    const handleToggleIgnore = (sheetName: string) => {
        setMappings(prev => prev.map(m =>
            m.sheetName === sheetName ? { ...m, ignore: !m.ignore } : m
        ));
    };

    // Función para asegurar que existan tipos base en la BD
    const ensureRequiredTypes = async (): Promise<{
        otrosId: string | null,
        herramientasId: string | null,
        herramientasCatId: string | null,
        manualSubcatId: string | null,
        electricaSubcatId: string | null
    }> => {
        const result = {
            otrosId: null as string | null,
            herramientasId: null as string | null,
            herramientasCatId: null as string | null,
            manualSubcatId: null as string | null,
            electricaSubcatId: null as string | null
        };
        try {
            // 1. Asegurar "Otros" (Asset Type)
            const { data: extOtros } = await supabase.from('asset_types').select('id').eq('name', 'Otros').single();
            if (extOtros) {
                result.otrosId = extOtros.id;
            } else {
                const { data: newOtros } = await supabase.from('asset_types').insert([{ name: 'Otros' }]).select().single();
                result.otrosId = newOtros?.id || null;
            }

            // 2. Asegurar "Herramientas" (Asset Type)
            const { data: extHerr } = await supabase.from('asset_types').select('id').eq('name', 'Herramientas').single();
            if (extHerr) {
                result.herramientasId = extHerr.id;
            } else {
                const { data: newHerr } = await supabase.from('asset_types').insert([{ name: 'Herramientas' }]).select().single();
                result.herramientasId = newHerr?.id || null;
            }

            // 3. Asegurar "Herramientas" (Category)
            const { data: extHerrCat } = await supabase.from('categories').select('id').eq('name', 'Herramientas').single();
            let herrCatId = extHerrCat?.id || null;
            if (!herrCatId) {
                const { data: newHerrCat } = await supabase.from('categories').insert([{ name: 'Herramientas' }]).select().single();
                herrCatId = newHerrCat?.id || null;
            }
            result.herramientasCatId = herrCatId;

            // 4. Asegurar Subcategorías de Herramientas
            if (herrCatId) {
                const { data: extManual } = await supabase.from('subcategories').select('id').eq('name', 'Herramienta manual').eq('category_id', herrCatId).single();
                if (extManual) {
                    result.manualSubcatId = extManual.id;
                } else {
                    const { data: newManual } = await supabase.from('subcategories').insert([{ name: 'Herramienta manual', category_id: herrCatId }]).select().single();
                    result.manualSubcatId = newManual?.id || null;
                }

                const { data: extElectrica } = await supabase.from('subcategories').select('id').eq('name', 'Herramienta eléctrica').eq('category_id', herrCatId).single();
                if (extElectrica) {
                    result.electricaSubcatId = extElectrica.id;
                } else {
                    const { data: newElectrica } = await supabase.from('subcategories').insert([{ name: 'Herramienta eléctrica', category_id: herrCatId }]).select().single();
                    result.electricaSubcatId = newElectrica?.id || null;
                }
            }

            return result;
        } catch (error) {
            console.error('Error al verificar/crear tipos base:', error);
            return result;
        }
    };

    const handleImport = async () => {
        if (!preview || !preview.processedRecords.length) return;
        setImporting(true);

        try {
            // Asegurar que tipos base existen
            const { otrosId, herramientasId, herramientasCatId, manualSubcatId, electricaSubcatId } = await ensureRequiredTypes();

            const batchSize = 50;
            const records = preview.processedRecords.map(record => {
                let finalTypeId = record.asset_type_id;
                let finalCatId = record.category_id;
                let finalSubcatId = record.subcategory_id;

                const typeRaw = record._typeRaw?.toUpperCase() || '';
                const descRaw = (record.descripcion || '').toUpperCase();

                // Si no tiene tipo, o es un fallback manual
                if (!finalTypeId) {
                    if (typeRaw.includes('HERRAMIENTA') ||
                        ['ALICATE', 'LLAVE', 'MARTILLO', 'TALADRO', 'DESTORNILLADOR', 'PINZA', 'ESMERIL'].some(t => typeRaw.includes(t)) ||
                        ['ALICATE', 'LLAVE', 'MARTILLO', 'TALADRO', 'DESTORNILLADOR', 'PINZA', 'ESMERIL'].some(t => descRaw.includes(t))) {
                        finalTypeId = herramientasId;
                    } else {
                        finalTypeId = otrosId;
                    }
                }

                // Lógica de Categoría y Subcategoría para Herramientas
                if (finalTypeId === herramientasId) {
                    finalCatId = herramientasCatId || finalCatId;

                    // Detección de subcategoría (Manual vs Eléctrica)
                    const isElectric = ['ELECTRICO', 'ELECTRICA', 'BATERIA', 'VOLTIOS', 'WATTS', 'MOTOR', 'CABLE', 'ENCHUFE', 'TALADRO', 'ESMERIL', 'SOLDADORA', 'COMPRESORA'].some(term => descRaw.includes(term) || typeRaw.includes(term));
                    if (isElectric) {
                        finalSubcatId = electricaSubcatId || finalSubcatId;
                    } else {
                        // Si es un alicate, llave, etc. suele ser manual
                        finalSubcatId = manualSubcatId || finalSubcatId;
                    }
                }

                // Eliminar campos auxiliares antes de insertar
                const { _typeRaw, _typeName, _categoryName, _subcategoryName, ...cleanData } = record;

                return {
                    ...cleanData,
                    asset_type_id: finalTypeId || otrosId,
                    category_id: finalCatId,
                    subcategory_id: finalSubcatId,
                    notes: null // Always null as requested to remove it
                };
            });

            for (let i = 0; i < records.length; i += batchSize) {
                const batch = records.slice(i, i + batchSize);
                const { error } = await supabase.from('assets').insert(batch);
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
                            <Upload size={18} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-normal text-white uppercase tracking-[0.2em] leading-tight">Importar Inventario desde Excel</h2>
                            <p className="text-[10px] font-normal text-blue-200 uppercase tracking-widest mt-0.5">Mapear manualmente las hojas a las sedes</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDownloadClick}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-none transition-all"
                            title="Descargar plantilla con columnas recomendadas"
                        >
                            <FileSpreadsheet size={14} />
                            Plantilla
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-none transition-all"
                        >
                            <X size={24} />
                        </button>
                    </div>
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
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <p className="text-sm text-green-700 font-medium text-center">
                                    ? Archivo seleccionado: {file.name}
                                </p>
                            </div>

                            {/* Stats Cards */}
                            {preview && (
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                        <div className="text-2xl font-normal text-slate-800">{preview.totalSheets}</div>
                                        <div className="text-xs text-slate-500 uppercase font-normal">Hojas detectadas</div>
                                    </div>
                                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                        <div className="text-2xl font-normal text-blue-600">{preview.totalRecords}</div>
                                        <div className="text-xs text-slate-500 uppercase font-normal">Total Registros</div>
                                    </div>
                                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm border-l-4 border-l-green-500">
                                        <div className="text-2xl font-normal text-green-600">{preview.validRecords}</div>
                                        <div className="text-xs text-slate-500 uppercase font-normal">Listos para importar</div>
                                    </div>
                                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm border-l-4 border-l-red-500">
                                        <div className="text-2xl font-normal text-red-600">{preview.invalidRecords}</div>
                                        <div className="text-xs text-slate-500 uppercase font-normal">Inválidos / Sin Sede</div>
                                    </div>
                                </div>
                            )}

                            {/* MAPPING TABLE */}
                            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                                <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex justify-between items-center">
                                    <h5 className="font-normal text-slate-700 text-sm uppercase tracking-wide">Mapeo de Sedes por Hoja</h5>
                                    <span className="text-xs text-slate-500">Asocia cada hoja del excel a una sede del sistema</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="gsc-table w-full text-sm text-left">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="px-6 py-3">Hoja (Excel)</th>
                                                <th className="px-6 py-3">Registros</th>
                                                <th className="px-6 py-3">Conexión (Sede y Grupo)</th>
                                                <th className="px-6 py-3 text-center">Estado</th>
                                                <th className="px-6 py-3 text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {mappings.map((mapping, idx) => {
                                                const sheetStat = rawSheets.find(s => s.name === mapping.sheetName);
                                                const recordCount = sheetStat?.data.length || 0;
                                                const isMapped = !!mapping.locationId || (preview?.validRecords !== undefined && preview.invalidRecords === 0);

                                                return (
                                                    <tr key={idx} className={`hover:bg-slate-50 transition-colors ${mapping.ignore ? 'opacity-50' : ''}`}>
                                                        <td className="px-6 py-3 font-medium text-slate-800">
                                                            {mapping.sheetName}
                                                        </td>
                                                        <td className="px-6 py-3 text-slate-600">
                                                            {recordCount}
                                                        </td>
                                                        <td className="px-6 py-3 flex flex-col gap-2">
                                                            <select
                                                                value={mapping.locationId}
                                                                onChange={(e) => handleMappingChange(mapping.sheetName, 'locationId', e.target.value)}
                                                                disabled={mapping.ignore}
                                                                className={`w-full max-w-xs px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${!isMapped && !mapping.ignore ? 'border-red-300 bg-red-50 text-red-900' : 'border-slate-200'
                                                                    }`}
                                                            >
                                                                <option value="">-- Autodetectar Sede desde fila --</option>
                                                                {locations.map(loc => (
                                                                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                                                                ))}
                                                            </select>
                                                            <select
                                                                value={mapping.categoryId}
                                                                onChange={(e) => handleMappingChange(mapping.sheetName, 'categoryId', e.target.value)}
                                                                disabled={mapping.ignore}
                                                                className="w-full max-w-xs px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                            >
                                                                <option value="">-- Autodetectar Grupo/Categoría --</option>
                                                                {categories.map(cat => (
                                                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
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

                            {/* Preview of first few records */}
                            {preview && preview.processedRecords.length > 0 && (
                                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                                    <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                                        <h5 className="font-normal text-slate-700 text-sm uppercase tracking-wide">Vista Previa de Categorización (Primeros 5 registros)</h5>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="gsc-table w-full text-[12px] text-left">
                                            <thead className="bg-slate-50 text-slate-500 uppercase font-normal tracking-widest">
                                                <tr>
                                                    <th className="px-6 py-3">Descripción</th>
                                                    <th className="px-6 py-3">Tipo Detectado</th>
                                                    <th className="px-6 py-3">Categoría</th>
                                                    <th className="px-6 py-3">Subcategoría</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {preview.processedRecords.filter(r => !!r.location_id).slice(0, 5).map((record, i) => (
                                                    <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                                                        <td className="px-6 py-3 font-normal text-slate-700 uppercase">{record.descripcion}</td>
                                                        <td className="px-6 py-3">
                                                            <span className="text-[11px] font-normal text-slate-500 uppercase">{record._typeName}</span>
                                                        </td>
                                                        <td className="px-6 py-3 font-normal text-slate-500 uppercase">{record._categoryName}</td>
                                                        <td className="px-6 py-3 font-normal text-slate-400 uppercase">{record._subcategoryName}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

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
                    <div className="text-[10px] font-normal text-slate-400 uppercase tracking-widest">
                        {preview ? `${preview.validRecords} registros válidos de ${preview.totalRecords} totales` : 'Esperando archivo...'}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            disabled={importing}
                            className="px-6 py-2 text-[10px] font-normal uppercase tracking-[0.2em] text-slate-600 bg-white border border-slate-200 rounded-none hover:bg-slate-50 transition-all disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleImport}
                            disabled={!file || !preview || preview.validRecords === 0 || importing}
                            className="px-8 py-2 text-[10px] font-normal uppercase tracking-[0.2em] text-white bg-blue-600 rounded-none hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg disabled:cursor-not-allowed"
                        >
                            {importing && <Loader size={14} />}
                            {importing ? 'Importando...' : `Importar ${preview?.validRecords || 0} Registros`}
                        </button>
                    </div>
                </div>
            </div>
        </ModalOverlay>
    );
};

export default ExcelImportModal;
