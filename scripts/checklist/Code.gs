/**
 * SISTEMA CENTRALIZADO MULTISEDE - ESCON
 * Versión 5.0: envía las OBSERVACIONES (comentarios) al Sistema GSC.
 *
 * Lee los bloques de comentarios del checklist — celdas combinadas de la
 * columna P hasta AB — y los empuja a la tabla `checklist_observaciones`
 * mediante la Edge Function `checklist-ingest`.
 *
 * Solo se envían las secciones que TIENEN comentario escrito. Las secciones
 * en blanco no generan registro.
 *
 * ── INSTALACIÓN (una vez, en cada una de las 8 hojas) ────────────────
 *   El script está COPIADO en cada hoja, así que cada copia tiene sus
 *   propias Script Properties. En cada hoja, desde Extensiones > Apps Script:
 *
 *     1) configurarIngesta()      → guarda URL + clave en ESTA hoja
 *     2) probarConexion()         → verifica clave, sede y rangos
 *                                    SIN escribir nada en la base
 *     3) exportarPDFyBorrar()     → el flujo real
 *
 *   La clave es la MISMA en las 8 hojas y en Supabase:
 *     supabase secrets set CHECKLIST_INGEST_KEY=<clave>
 *
 * ── EN SUPABASE (una sola vez, no por hoja) ───────────────────────────
 *   supabase db push
 *   supabase functions deploy checklist-ingest --no-verify-jwt
 *
 *   El --no-verify-jwt es obligatorio: el gateway exige un JWT de Supabase
 *   por defecto, y este script se autentica con el header x-api-key.
 * ────────────────────────────────────────────────────────────────────
 */

var ID_CARPETA_RAIZ = "11mbLnt2_WDS5-o0Eg_9HpL-mtWjsZF_w";
var RANGO_EQUIPOS = "A21:S30";
var RANGO_FLOTA = "A34:Y42";
var CELDA_FECHA = "S4";

var COLORES_SEDES = {
  "ESCON MBS ATE": "#EFEFEF", "ESCON SCVIP CALLAO": "#CFE2F3", "ESCON SCP ICA": "#F4CCCC",
  "ESCON SCVIP HUACHO": "#D9EAD3", "ESCON MBS AYACUCHO": "#FCE5CD", "ESCON SCP ANDAHUAYLAS": "#EAD1DC",
  "ESCON SCVIP IZAGUIRRE": "#FFF2CC", "ESCON MBS HUANCAVELICA": "#D9D2E9"
};

var CARPETAS_PDF_SEDES = {
  "ESCON MBS ATE": "1K2ssAn0xXAK_IaA_QyR-B47ZqhIhywEx", "ESCON SCVIP CALLAO": "1LVXJ58CcJQ8qDfgN5j1gC42QWvdbvoe9",
  "ESCON SCP ICA": "1mVYHgltjXwAi-MZ1q6J95SWoq3XVMTLF", "ESCON SCVIP HUACHO": "1L7B4qwXgp8jTfeMmd25u6aPNz1I96YhD",
  "ESCON MBS AYACUCHO": "1tRh_5ZcAAIsPbmZb6J8i7wt8OWMJ178W", "ESCON SCP ANDAHUAYLAS": "1dvr-MsyxcbA4tST7x3VlvNfX-XjqL-D-",
  "ESCON SCVIP IZAGUIRRE": "1cO1bOJ0NoYcfa8DtLT2nekyoFLrnDeTP", "ESCON MBS HUANCAVELICA": "1xb1xFUqHuNUQW0AcmJ64XKkqGJFUTm76"
};

/**
 * BLOQUES DE OBSERVACIONES
 *
 * `rango`          → la celda de comentario está COMBINADA: el valor real
 *                    vive en la celda superior izquierda (primera columna
 *                    del rango). Las demás columnas de la fila están vacías.
 * `etiquetaDesde`  → inicio de la ventana donde se busca el nombre de la
 * `etiquetaHasta`    sección, escaneando de derecha a izquierda.
 *
 * Ajustá estos rangos según tu hoja. `diagnosticarBloques()` te muestra
 * exactamente qué se detectó para que puedas ajustarlos a ojo.
 */
var BLOQUES_OBSERVACIONES = [
  { bloque: "PERSONAL", rango: "P9:AB17", etiquetaDesde: "A", etiquetaHasta: "O" },
  { bloque: "EQUIPOS", rango: "S22:AB30", etiquetaDesde: "A", etiquetaHasta: "B" }
];

/**
 * Versión del archivo.
 *
 * Este Code.gs se pega a mano en las 8 sedes, así que es fácil que una quede
 * con una versión vieja y otra con la nueva. `probarConexion()` muestra este
 * número: si no dice 2026-09-25.2, esa hoja está desactualizada y hay que
 * pegarle el archivo de nuevo.
 *
 * Subir el número cada vez que se cambie algo que afecte lo que se envía
 * (rangos, nombres de bloque, resolución de sede).
 */
var VERSION_CHECKLIST = "2026-09-25.3";

/** Marcas de checklist que NO son nombre de sección. */
var MARCAS_IGNORADAS = ["X", "✓", "✔", "SI", "SÍ", "OK"];

/**
 * Sede a la que se envían los comentarios de ESTA hoja.
 *
 * VACÍO en las 8 hojas: el vínculo normal no pasa por acá. La Edge Function
 * resuelve la sede leyendo `locations.checklist_sede` en la base, que es un
 * solo lugar para todas las hojas y se corrige con un UPDATE.
 *
 * Llenalo solo como override de emergencia, cuando la base todavía no
 * tiene cargada la fila de esa sede. El valor tiene que ser el nombre de la
 * hoja ("ESCON MBS ATE"), que es lo que la función busca.
 */
var SEDE_EXPLICITA = "";


// ═══════════════════════════════════════════════════════════════
// MENÚ DE LA HOJA
//
// Para no depender del dropdown de funciones del editor (donde es
// fácil correr exportarPDFyBorrar sin querer y saltarse la
// configuración), todo se expone como un menú dentro de la hoja.
// ═══════════════════════════════════════════════════════════════

/**
 * Trigger de apertura de la hoja.
 *
 * Tiene que quedar como función global sin argumentos: es lo que Apps Script
 * detecta para crear el menú. Este archivo se pega completo y por igual en
 * las 8 sedes, así que no puede depender de una librería compartida.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📋 Checklist GSC')
    .addItem('1 · Configurar conexión', 'configurarIngesta')
    .addItem('2 · Probar conexión', 'probarConexion')
    .addSeparator()
    .addItem('Exportar y borrar', 'exportarPDFyBorrar')
    .addItem('Diagnosticar bloques', 'diagnosticarBloques')
    .addToUi();
}


// ═══════════════════════════════════════════════════════════════
// EXPORTACIÓN PRINCIPAL
// ═══════════════════════════════════════════════════════════════

function exportarPDFyBorrar() {
  var lock = LockService.getScriptLock();

  // El candado evita que dos exportaciones de la misma sede corran a la vez:
  // la Edge Function borra por (sede, fecha) y reinserta, así que dos procesos
  // simultáneos se pisan. 2 minutos es suficiente para el trabajo real; si no
  // se obtiene en ese plazo lo que hay es una ejecución colgada, no lentitud.
  try {
    lock.waitLock(120000);
  } catch (e) {
    SpreadsheetApp.getUi().alert(
      "⏳ Hay otra exportación en curso.\n\n" +
      "Esperá a que termine y volvé a intentar.\n\n" +
      "Si nunca termina: Extensiones > Apps Script > Ejecuciones, fijate la\n" +
      'que dice "En ejecución" y presioná los tres puntitos > Detener.'
    );
    return;
  }

  try {

   var ui = SpreadsheetApp.getUi();
   var ss = SpreadsheetApp.getActiveSpreadsheet();
   var hoja = ss.getActiveSheet();
   // Dos sedes distintas y no intercambiables:
   //   sede      = nombre de la HOJA. Va al consolidado y a los colores, y
   //               el consolidado guarda este string en la columna A, así que
   //               cambiarlo dejaría huérfanas las filas de exportaciones
   //               anteriores (el borrado ya no las encontraría).
   //   sedeEnvio = nombre con el que la sede existe en la app. Solo viaja en
   //               el payload a la Edge Function.
   var sede = detectarSede(ss.getName());
   var sedeEnvio = resolverSede(ss);
   var tz = Session.getScriptTimeZone();
    var fecha = Utilities.formatDate(new Date(), tz, 'dd-MM-yyyy');
    var fechaISO = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    var colorSede = COLORES_SEDES[sede] || "#FFFFFF";

    var resFinal = { eqOp: 0, eqIn: 0, flUrg: 0, flAtn: 0, flOk: 0, obs: 0 };

    // --- 1. GESTIÓN DE CARPETAS Y CONSOLIDADO ---
    var carpetaRaiz = DriveApp.getFolderById(ID_CARPETA_RAIZ);
    var carpetaPrincipal = obtenerOCrearSubcarpeta(carpetaRaiz, "Checklist en Excel");
    var carpetaDia = obtenerOCrearSubcarpeta(carpetaPrincipal, "Día " + fecha);

    var nombreConsolidado = "REPORTE CONSOLIDADO - " + fecha;
    var archivos = carpetaDia.getFilesByName(nombreConsolidado);
    var nuevoSS;
    if (archivos.hasNext()) {
      nuevoSS = SpreadsheetApp.open(archivos.next());
      eliminarFilasPorSede(nuevoSS, "EQUIPOS", sede);
      eliminarFilasPorSede(nuevoSS, "FLOTA", sede);
    } else {
      nuevoSS = SpreadsheetApp.create(nombreConsolidado);
      DriveApp.getFileById(nuevoSS.getId()).moveTo(carpetaDia);
    }

    // --- 2. PROCESAR DATOS ---
    procesarEquiposConColor(hoja, nuevoSS, sede, resFinal, colorSede);
    procesarFlotaConColor(hoja, nuevoSS, sede, resFinal, colorSede);

    // --- 3. LEER OBSERVACIONES (antes de limpiar cualquier celda) ---
    var observaciones = leerObservaciones(hoja);
    resFinal.obs = observaciones.length;

    // --- 4. GENERAR PDF ---
    SpreadsheetApp.flush();
    var idPDF = CARPETAS_PDF_SEDES[sede];
    if (idPDF) {
      var url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=pdf&portrait=true&size=A4&gid=' + hoja.getSheetId() + '&range=A1:AB75';
      var res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } });
      DriveApp.getFolderById(idPDF).createFile(res.getBlob().setName(sede + " - " + fecha + ".pdf"));
    }

    // --- 5. ENVIAR OBSERVACIONES AL SISTEMA ---
    // Si esto falla NO se limpia nada: los comentarios siguen en la hoja
    // y se pueden reintentar sin perder información.
    //
    // Se manda siempre, incluso el array vacío: así, si el supervisor borró
    // un comentario y reexporta, ese comentario desaparece del sistema en
    // lugar de quedar fantasma.
    var rObs = enviarObservaciones(sedeEnvio, fechaISO, observaciones);
    var obsEnviadas = rObs.insertados || 0;
    var sedeVinculada = rObs.sede_vinculada || null;

    // --- 6. LIMPIEZA SEGURA CELDA POR CELDA ---
    rangosALimpiar().forEach(function (r) {
      var range = hoja.getRange(r);
      var values = range.getValues();
      for (var row = 0; row < values.length; row++) {
        for (var col = 0; col < values[row].length; col++) {
          try { range.getCell(row + 1, col + 1).clearContent(); } catch (e) { }
        }
      }
    });

    // --- 7. RESUMEN FINAL ---
    var mensajeResumen = "Reporte Procesado con éxito.\n\n" +
      "📍 SEDE: " + sede + "\n" +
      "------------------------------------------\n" +
      "🛠 EQUIPOS:\n" +
      "   • [✔] Operativos: " + resFinal.eqOp + "\n" +
      "   • [✘] Inoperativos: " + resFinal.eqIn + "\n\n" +
      "🚚 FLOTA VEHICULAR:\n" +
      "   • [🚨] Urgentes: " + resFinal.flUrg + "\n" +
      "   • [⚠️] Atención: " + resFinal.flAtn + "\n" +
      "   • [✅] Estables: " + resFinal.flOk + "\n\n" +
      "📝 OBSERVACIONES:\n" +
      "   • Secciones con comentario: " + obsEnviadas + "\n" +
      (sedeVinculada
        ? "   • Sede vinculada: " + sedeVinculada + "\n"
        : "   • ⚠️ Sede NO vinculada: solo gerencia verá estos comentarios\n") +
      "------------------------------------------\n" +
      "✅ PDF enviado, datos consolidados y observaciones sincronizadas.";

    ui.alert(mensajeResumen);

  } catch (e) {
    ui.alert("❌ ERROR: " + e.message +
      "\n\n(No se limpió ningún comentario de la hoja. Podés reintentar el envío.)");
  } finally {
    lock.releaseLock();
  }
}


// ═══════════════════════════════════════════════════════════════
// OBSERVACIONES
// ═══════════════════════════════════════════════════════════════

/**
 * Lee los bloques de comentarios definidos en BLOQUES_OBSERVACIONES.
 *
 * Devuelve [{ bloque, seccion, comentario }] con solo las filas que
 * tienen texto. Tolera que la celda esté combinada o no: si no lo está,
 * concatena los pedazos sueltos de la fila.
 */
function leerObservaciones(hoja) {
  var resultado = [];

  BLOQUES_OBSERVACIONES.forEach(function (cfg) {
    var r = parseA1(cfg.rango);
    var filas = hoja.getRange(cfg.rango).getDisplayValues();

    var colEtiquetaIni = colToIndex(cfg.etiquetaDesde);
    var colEtiquetaFin = colToIndex(cfg.etiquetaHasta);
    var etiquetas = hoja.getRange(r.rowIni, colEtiquetaIni, filas.length, colEtiquetaFin - colEtiquetaIni + 1)
      .getDisplayValues();

    for (var i = 0; i < filas.length; i++) {
      var comentario = joinearTexto(filas[i]);
      if (!comentario) continue;

      var seccion = buscarEtiqueta(etiquetas[i]);
      if (!seccion) seccion = "Fila " + (r.rowIni + i);

      resultado.push({ bloque: cfg.bloque, seccion: seccion, comentario: comentario });
    }
  });

  return resultado;
}

/** Rango de una celda combinada = todo su contenido. Sin combinar = pieces sueltos. */
function joinearTexto(celdas) {
  return celdas
    .map(function (c) { return String(c == null ? '' : c).trim(); })
    .filter(function (c) { return c.length > 0; })
    .join(' ');
}

/** Primera etiqueta con texto real, escaneando de derecha a izquierda. */
function buscarEtiqueta(celdas) {
  for (var i = celdas.length - 1; i >= 0; i--) {
    var v = String(celdas[i] == null ? '' : celdas[i]).trim();
    if (!v) continue;
    if (MARCAS_IGNORADAS.indexOf(v.toUpperCase()) !== -1) continue;
    return v;
  }
  return "";
}

/** Rangos a limpiar, derivados de la config para que nunca se desincronicen. */
function rangosALimpiar() {
  return BLOQUES_OBSERVACIONES.map(function (cfg) { return cfg.rango; });
}

/**
 * POST a la Edge Function `checklist-ingest`.
 * Lanza error si la clave falta o si el servidor responde != 200.
 *
 * @param {boolean} dryRun si es true, el servidor valida y responde SIN escribir.
 */
function enviarObservaciones(sede, fechaISO, observaciones, dryRun) {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('SUPABASE_URL');
  var key = props.getProperty('CHECKLIST_INGEST_KEY');

  if (!url || !key) {
    throw new Error("Falta configurar la conexión en ESTA hoja.\n\n" +
      "Andá al menú 📋 Checklist GSC de la hoja y elegí '1 · Configurar conexión'.\n" +
      "Es una operación de una sola vez por cada hoja.");
  }

  var res = UrlFetchApp.fetch(url.replace(/\/+$/, '') + '/functions/v1/checklist-ingest', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': key },
    payload: JSON.stringify({
      sede: sede,
      fecha: fechaISO,
      origen: 'google-apps-script',
      dry_run: dryRun === true,
      observaciones: observaciones
    }),
    muteHttpExceptions: true
  });

  var code = res.getResponseCode();
  if (code !== 200) {
    throw new Error("La Edge Function respondió " + code + ": " + res.getContentText());
  }

  return JSON.parse(res.getContentText());
}

/** Configuración inicial: guarda URL y clave en Script Properties. */
function configurarIngesta() {
  var ui = SpreadsheetApp.getUi();
  var url = ui.prompt(
    "1/2 — URL de Supabase",
    "Ej: https://abcdefg.supabase.co\n\nSe toma de Project Settings > API > Project URL.",
    ui.ButtonSet.OK_CANCEL
  );
  if (url.getSelectedButton() !== ui.Button.OK) return;

  var key = ui.prompt(
    "2/2 — Clave de ingesta",
    "Es la MISMA clave que seteaste en la Edge Function:\n" +
    "  supabase secrets set CHECKLIST_INGEST_KEY=<clave>\n\n" +
    "Se guarda en Script Properties (no queda en el código).",
    ui.ButtonSet.OK_CANCEL
  );
  if (key.getSelectedButton() !== ui.Button.OK) return;

  var props = PropertiesService.getScriptProperties();
  props.setProperties({
    SUPABASE_URL: url.getResponseText().trim().replace(/\/+$/, ''),
    CHECKLIST_INGEST_KEY: key.getResponseText().trim()
  });

  ui.alert("✅ Configuración guardada para ESTA hoja.\n\n" +
    "Como el script está copiado en cada sede, hay que repetir esto en las 8.\n\n" +
    "Después, en cada hoja, corré:\n" +
    "  1) probarConexion()       → verifica clave + sede + rangos SIN escribir\n" +
    "  2) exportarPDFyBorrar()   → el envío completo");
}

/**
 * Verificación en seco: comprueba la clave, que la sede exista en el sistema
 * y qué comentarios detectaría, SIN escribir nada en la base.
 *
 * Es el primer paso en cada una de las 8 copias del script: si `probarConexion()`
 * dice "sede vinculada" y lista las secciones correctas, `exportarPDFyBorrar()`
 * va a funcionar.
 */
function probarConexion() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sedeEnvio = resolverSede(ss);
  var fechaISO = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var observaciones = leerObservaciones(ss.getActiveSheet());

   if (sedeEnvio === "SEDE DESCONOCIDA") {
      ui.alert("❌ No se pudo determinar la sede de esta hoja.\n\n" +
        "La hoja se llama: " + ss.getName() + "\n\n" +
        "Se envía el NOMBRE DE LA HOJA, no el de la app. La función lo busca\n" +
        "contra locations.checklist_sede.\n\n" +
        "Opción 1: renombrá la hoja con el nombre exacto de una sede\n" +
        "(ej: 'ESCON MBS ATE'). Conviene renombrar la pestaña, no el archivo.\n\n" +
        "Opción 2: cargá el vínculo en la base con esta consulta,\n" +
        "cambiando el nombre de la sede:\n\n" +
        "  update public.locations\n" +
        "     set checklist_sede = '" + ss.getName() + "'\n" +
        "   where name = 'Mi Brevete Seguro ATE';\n\n" +
        "Opción 3: completá SEDE_EXPLICITA en este archivo con '" +
        ss.getName() + "' (afecta a las 8 hojas, úsala solo de emergencia).");
      return;
   }

   if (SEDE_EXPLICITA) {
      ui.alert("ℹ️ Se va a usar SEDE_EXPLICITA: '" + sedeEnvio + "'.\n\n" +
        "El nombre de la hoja es '" + ss.getName() + "'.");
   }

  try {
    var r = enviarObservaciones(sedeEnvio, fechaISO, observaciones, true);

    var lineas = [
      "✅ CONEXIÓN OK",
      "",
      "Code.gs versión:    " + VERSION_CHECKLIST,
      "Sede a enviar:      " + sedeEnvio,
      "Sede en el sistema: " + (r.sede_vinculada || "⚠️ NO ENCONTRADA"),
      "Fecha:              " + r.fecha,
      "Secciones a enviar: " + r.secciones_detectadas
    ];

    if (r.secciones && r.secciones.length) {
      lineas.push("");
      r.secciones.forEach(function (s) { lineas.push("  • " + s); });
    }

    if (!r.sede_vinculada) {
      lineas.push("");
      lineas.push("⚠️ El nombre de la hoja no coincide con ninguna sede del sistema.");
      lineas.push("Los comentarios se guardarán igual, pero solo gerencia los verá.");
      lineas.push("Revisá que el nombre de la sede en Sedes sea parecido al de la hoja.");
    }

    lineas.push("");
    lineas.push(observaciones.length === 0
      ? "ℹ️ No hay comentarios escritos. Se enviarán 0 observaciones."
      : "Nada se escribió en la base. Ya podés correr exportarPDFyBorrar().");

    ui.alert(lineas.join("\n"));

  } catch (e) {
    ui.alert("❌ FALLA LA CONEXIÓN\n\n" + e.message +
      "\n\nRevisá:\n" +
      "  • ¿Corriste configurarIngesta() en ESTA hoja?\n" +
      "  • ¿La CHECKLIST_INGEST_KEY es la misma que pusiste en Supabase?\n" +
      "  • ¿Deployaste con --no-verify-jwt?\n" +
      "    supabase functions deploy checklist-ingest --no-verify-jwt");
  }
}

/**
 * Muestra qué se detectaría en cada bloque, sin enviar ni limpiar nada.
 * Sirve para ajustar BLOQUES_OBSERVACIONES a tu hoja real.
 */
function diagnosticarBloques() {
  var ui = SpreadsheetApp.getUi();
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var obs = leerObservaciones(hoja);
  var lineas = [];

  BLOQUES_OBSERVACIONES.forEach(function (cfg) {
    var r = parseA1(cfg.rango);
    lineas.push("── " + cfg.bloque + "  (" + cfg.rango + ")");
    lineas.push("   filas " + r.rowIni + " a " + r.rowFin +
      " | etiquetas en " + cfg.etiquetaDesde + ":" + cfg.etiquetaHasta);
  });

  lineas.push("");
  lineas.push(observaciones.length === 0
    ? "⚠️ No se detectó ningún comentario. Revisá los rangos."
    : "✅ Se detectarían " + observaciones.length + " observación(es):");

  obs.forEach(function (o) {
    lineas.push("");
    lineas.push("   [" + o.bloque + "] " + o.seccion);
    lineas.push("      " + o.comentario);
  });

  ui.alert(lineas.join("\n"));
}
// ═══════════════════════════════════════════════════════════════
// FUNCIONES CON LÓGICA DE COLOR Y ESTADO GLOBAL
// ═══════════════════════════════════════════════════════════════

function procesarEquiposConColor(hojaOrigen, ssDestino, sede, res, colorSede) {
  var hE = ssDestino.getSheetByName("EQUIPOS") || ssDestino.insertSheet("EQUIPOS");
  if (hE.getLastRow() === 0) {
    hE.appendRow(["SEDE", "EQUIPO", "ESTADO", "COMENTARIOS"]);
    hE.getRange("A1:D1").setBackground("#444444").setFontColor("white").setFontWeight("bold").setHorizontalAlignment("center");
  }

  var datos = hojaOrigen.getRange(RANGO_EQUIPOS).getValues();
  for (var i = 1; i < datos.length; i++) {
    if (!datos[i][1]) continue;
    var esOp = (datos[i][14] && datos[i][14].toString().toUpperCase() === "X");
    var esIn = (datos[i][16] && datos[i][16].toString().toUpperCase() === "X");
    var estadoTxt = esOp ? "OPERATIVO" : (esIn ? "INOPERATIVO" : "N/A");

    if (esOp) res.eqOp++; else if (esIn) res.eqIn++;

    hE.appendRow([sede, datos[i][1], estadoTxt, datos[i][18]]);
    var uRow = hE.getLastRow();
    hE.getRange(uRow, 1).setBackground(colorSede).setFontWeight("bold");
    var celdaEstado = hE.getRange(uRow, 3);
    if (esOp) celdaEstado.setBackground("#34a853").setFontColor("white");
    else if (esIn) celdaEstado.setBackground("#ea4335").setFontColor("white");
    hE.getRange(uRow, 1, 1, 4).setBorder(true, true, true, true, true, true).setHorizontalAlignment("center");
  }
}

function procesarFlotaConColor(hojaOrigen, ssDestino, sede, res, colorSede) {
  var hF = ssDestino.getSheetByName("FLOTA") || ssDestino.insertSheet("FLOTA");
  if (hF.getLastRow() === 0) {
    hF.appendRow(["SEDE", "PLACA", "SOAT", "PÓLIZA", "CITV", "CONTRATO", "ESTADO GLOBAL"]);
    hF.getRange("A1:G1").setBackground("#444444").setFontColor("white").setFontWeight("bold").setHorizontalAlignment("center");
  }

  var dF = hojaOrigen.getRange(RANGO_FLOTA).getDisplayValues();
  var dFRaw = hojaOrigen.getRange(RANGO_FLOTA).getValues();
  var hoy = new Date();
  var limiteAtencion = new Date();
  limiteAtencion.setDate(hoy.getDate() + 30); // 30 días para alerta naranja

  for (var j = 1; j < dF.length; j++) {
    if (!dF[j][0]) continue;

    var peorEstado = "ESTABLE"; // Por defecto

    hF.appendRow([sede, dF[j][0], dF[j][4], dF[j][10], dF[j][16], dF[j][22], ""]);
    var uRow = hF.getLastRow();
    hF.getRange(uRow, 1).setBackground(colorSede).setFontWeight("bold");

    // Revisar columnas SOAT, PÓLIZA, CITV, CONTRATO (Índices 4, 10, 16, 22 del rango original)
    [4, 10, 16, 22].forEach(function (colIdxOriginal, x) {
      var colDestino = x + 3; // SOAT empieza en col 3 del consolidado
      var fechaVal = dFRaw[j][colIdxOriginal];

      if (fechaVal instanceof Date) {
        if (fechaVal <= hoy) {
          hF.getRange(uRow, colDestino).setBackground("#ea4335").setFontColor("white");
          peorEstado = "URGENTE";
        } else if (fechaVal <= limiteAtencion) {
          hF.getRange(uRow, colDestino).setBackground("#fbbc04").setFontColor("black");
          if (peorEstado !== "URGENTE") peorEstado = "ATENCIÓN";
        } else {
          hF.getRange(uRow, colDestino).setBackground("#34a853").setFontColor("white");
        }
      }
    });

    // Escribir y pintar el Estado Global
    var celdaGlobal = hF.getRange(uRow, 7);
    if (peorEstado === "URGENTE") {
      celdaGlobal.setValue("🚨 URGENTE").setBackground("#ea4335").setFontColor("white");
      res.flUrg++;
    } else if (peorEstado === "ATENCIÓN") {
      celdaGlobal.setValue("⚠️ ATENCIÓN").setBackground("#fbbc04").setFontColor("black");
      res.flAtn++;
    } else {
      celdaGlobal.setValue("✅ ESTABLE").setBackground("#34a853").setFontColor("white");
      res.flOk++;
    }

    hF.getRange(uRow, 1, 1, 7).setBorder(true, true, true, true, true, true).setHorizontalAlignment("center");
  }
}

function eliminarFilasPorSede(ss, nH, sN) {
  var s = ss.getSheetByName(nH); if (!s) return;
  var d = s.getRange("A:A").getValues();
  for (var i = d.length - 1; i >= 0; i--) { if (d[i][0] === sN) s.deleteRow(i + 1); }
}

function detectarSede(n) {
  for (var s in COLORES_SEDES) { if (n.toUpperCase().includes(s)) return s; }
  return "SEDE DESCONOCIDA";
}

/**
 * Decide la sede de ESTA hoja.
 *
 * 1. SEDE_EXPLICITA, si está llena (override de emergencia).
 * 2. Si no, la deduce del nombre de la hoja.
 *
 * Ojo: lo que sale de acá es el NOMBRE DE LA HOJA, no el de la sede en la
 * app. Traducir uno por otro es trabajo de la base (locations.checklist_sede),
 * porque si se tradujera acá habría que mantener la tabla en 8 copias del
 * script en vez de en un solo lugar.
 */
function resolverSede(ss) {
  var explicita = String(SEDE_EXPLICITA || "").trim();
  if (explicita) return explicita;
  return detectarSede(ss.getName());
}

function obtenerOCrearSubcarpeta(p, n) {
  var f = p.getFoldersByName(n); return f.hasNext() ? f.next() : p.createFolder(n);
}


// ═══════════════════════════════════════════════════════════════
// UTILIDADES A1
// ═══════════════════════════════════════════════════════════════

/** "P9:AB17" → { colIni: 16, rowIni: 9, colFin: 28, rowFin: 17 } */
function parseA1(a1) {
  var m = String(a1).match(/^\s*([A-Za-z]+)\s*(\d+)\s*:\s*([A-Za-z]+)\s*(\d+)\s*$/);
  if (!m) throw new Error("Rango A1 inválido: " + a1);
  return {
    colIni: colToIndex(m[1]), rowIni: parseInt(m[2], 10),
    colFin: colToIndex(m[3]), rowFin: parseInt(m[4], 10)
  };
}

/** "AB" → 28 */
function colToIndex(col) {
  var n = 0;
  var s = String(col).toUpperCase();
  for (var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
  return n;
}
