import ExcelJS from 'exceljs';
import { supabase } from '../services/supabase';

export const generateAndDownloadTemplate = async () => {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Plantilla');
        const validationSheet = workbook.addWorksheet('Validaciones');
        validationSheet.state = 'hidden'; // Ocultar hoja de datos auxiliares

        // Consultar datos para dejarlos disponibles en formato lista
        const { data: areasData } = await supabase.from('areas').select('name');
        const { data: assetTypesData } = await supabase.from('asset_types').select('name');
        const { data: categoriesData } = await supabase.from('categories').select('name');
        const { data: subcategoriesData } = await supabase.from('subcategories').select('name');
const { data: locationsData } = await supabase.from('locations').select('name').eq('is_active', true);

        const defaultAreas = [
          'Línea 1', 'Línea 2', 'Counter', 'Oficina Administrativa', 'Almacén',
          'Sala de espera', 'Servicios Higiénicos', 'Aula 1', 'Aula 2',
          'Consultorio Médico', 'Triaje', 'Psicosensométrico', 'Laboratorio', 'Pista / Circuito'
        ];
        const areasList = [...new Set([...(areasData || []).map(a => a.name), ...defaultAreas])].filter(Boolean);
        const typesList = [...new Set((assetTypesData || []).map(t => t.name))].filter(Boolean);
        const catList = ['Tecnología', 'Seguridad y Control', 'Equipos de línea', 'Mobiliario', 'Útiles y Suministros'];
        const subcatList = [...new Set((subcategoriesData || []).map(s => s.name))].filter(Boolean);
const locationsList = [...new Set((locationsData || []).map(l => l.name))].filter(Boolean);
        
        const estados = ['Operativo', 'Inoperativo', 'En Reparación', 'Baja'];
        const condiciones = ['Nuevo', 'Bueno', 'Regular', 'Malo'];

        // Llenar hoja de validaciones
        const maxRows = Math.max(typesList.length, catList.length, subcatList.length, areasList.length, estados.length, condiciones.length, locationsList.length);
        
        validationSheet.getCell('A1').value = 'Tipos';
        validationSheet.getCell('B1').value = 'Categorías';
        validationSheet.getCell('C1').value = 'Subcategorías';
        validationSheet.getCell('D1').value = 'Áreas';
        validationSheet.getCell('E1').value = 'Estados de Uso';
        validationSheet.getCell('F1').value = 'Condiciones';
        validationSheet.getCell('G1').value = 'Ubicaciones';

        for (let i = 0; i < maxRows; i++) {
            if (typesList[i]) validationSheet.getCell(`A${i+2}`).value = typesList[i];
            if (catList[i]) validationSheet.getCell(`B${i+2}`).value = catList[i];
            if (subcatList[i]) validationSheet.getCell(`C${i+2}`).value = subcatList[i];
            if (areasList[i]) validationSheet.getCell(`D${i+2}`).value = areasList[i];
            if (estados[i]) validationSheet.getCell(`E${i+2}`).value = estados[i];
            if (condiciones[i]) validationSheet.getCell(`F${i+2}`).value = condiciones[i];
            if (locationsList[i]) validationSheet.getCell(`G${i+2}`).value = locationsList[i];
        }

        const columns = [
            'ITEM', 'CATEGORÍA', 'SEDE',
            'ACTIVO', 'MARCA', 'MODELO', 'SERIE', 
            'COLOR', 'CANTIDAD', 'CONDICIÓN', 'ESTADO DE USO',
            'VALOR ESTIMADO', 'AÑO DE ADQUISICIÓN'
        ];
        
        worksheet.addRow(columns);
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002855' } }; // Corporate Blue
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 25;

        // Aplicar listas desplegables a las 1000 primeras filas
        for (let row = 2; row <= 1000; row++) {
            // TIPO DE ACTIVO (A)
            if(typesList.length) {
                worksheet.getCell(`A${row}`).dataValidation = {
                    type: 'list', allowBlank: true, formulae: [`Validaciones!$A$2:$A$${typesList.length + 1}`]
                };
            }

            // CATEGORÍA (B)
            if(catList.length) {
                worksheet.getCell(`B${row}`).dataValidation = {
                    type: 'list', allowBlank: true, formulae: [`Validaciones!$B$2:$B$${catList.length + 1}`]
                };
            }

            // SEDE (C)
            if (locationsList.length) {
                worksheet.getCell(`C${row}`).dataValidation = {
                    type: 'list', allowBlank: true, formulae: [`Validaciones!$G$2:$G$${locationsList.length + 1}`]
                };
            }

            // CONDICIÓN (J)
            worksheet.getCell(`J${row}`).dataValidation = {
                type: 'list', allowBlank: true, formulae: [`Validaciones!$F$2:$F$${condiciones.length + 1}`]
            };

            // ESTADO DE USO (K)
            worksheet.getCell(`K${row}`).dataValidation = {
                type: 'list', allowBlank: true, formulae: [`Validaciones!$E$2:$E$${estados.length + 1}`]
            };
        }

        worksheet.columns.forEach(column => {
            column.width = 22;
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Plantilla_Inventario.xlsx';
        link.click();
        URL.revokeObjectURL(url);
        
    } catch (error) {
        throw error;
    }
};
