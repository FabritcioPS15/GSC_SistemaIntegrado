import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

declare const Deno: any;

/**
 * checklist-ingest
 *
 * Recibe las observaciones de checklist exportadas desde el Apps Script
 * "Sistema Centralizado Multisede - ESCON" y las guarda en
 * `checklist_observaciones`.
 *
 * DEPLOY (el flag es obligatorio, si no el gateway exige un JWT de Supabase
 * y vos te autenticás con x-api-key):
 *   supabase functions deploy checklist-ingest --no-verify-jwt
 *
 * Seguridad:
 *   - Requiere header `x-api-key` igual a la variable de entorno
 *     CHECKLIST_INGEST_KEY. Sin esa clave no se escribe nada.
 *   - Usa la SERVICE_ROLE key, que ignora RLS. Por eso la tabla no tiene
 *     políticas de INSERT/UPDATE/DELETE para el rol `authenticated`.
 *
 * Idempotencia:
 *   Borra todas las filas de (sede, fecha) antes de insertar. Si el
 *   supervisor borra un comentario en la hoja y vuelve a exportar, ese
 *   comentario desaparece del sistema en lugar de quedar huérfano.
 *   Cada día es un (sede, fecha) distinto, así que el histórico se acumula.
 *
 * Payload:
 *   {
 *     "sede": "ESCON MBS ATE",
 *     "fecha": "2026-09-25",
 *     "origen": "google-apps-script",
 *     "dry_run": false,              // true = valida y responde, no escribe
 *     "observaciones": [
 *       { "bloque": "COMENTARIOS", "seccion": "Equipamiento", "comentario": "Falta chaleco reflectante" }
 *     ]
 *   }
 */

interface Observacion {
  bloque: string;
  seccion: string;
  comentario: string;
}

interface IngestPayload {
  sede: string;
  fecha: string;
  origen?: string;
  dry_run?: boolean;
  observaciones: Observacion[];
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-api-key",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

/** Convierte "25-09-2026" (formato del Apps Script) a "2026-09-25" (ISO date). */
function normalizarFecha(fecha: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;

  const iso = fecha.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`;

  return null;
}

/** Rango de marcas diacríticas combinantes Unicode (U+0300–U+036F). */
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

/** Sin acentos, en mayúsculas, sin dobles espacios. Para comparar nombres. */
function normalizarNombre(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Busca la sede en `locations` a partir del nombre de la hoja.
 *
 * El vínculo vive en `locations.checklist_sede` (migración
 * 20260925000004), NO en un mapa de este archivo. Es a propósito: el nombre
 * de la hoja ("ESCON MBS ATE") y el de la sede ("Mi Brevete Seguro ATE") no
 * comparten ni una palabra, así que hay que declarar el vínculo en algún
 * lado, y en la base se corrige con un UPDATE sin redesplegar nada.
 *
 * Tres pasadas, de la más estricta a la más floja:
 *
 *   1. la hoja se llama igual que la sede
 *   2. `locations.checklist_sede` dice exactamente qué hoja es
 *   3. una hoja que contenga a otra, para tolerar sufijos ("... - enero")
 *
 * Ninguna elige entre candidatos múltiples: ambiguo es peor que no
 * vinculado. Se prefiere guardar la observación sin sede (solo la verá
 * gerencia) que asignarla a la sede equivocada.
 */
const MIN_PARTICULA = 8;

async function resolverLocationId(
  supabase: any,
  sede: string,
): Promise<{ id: string; name: string } | null> {
  const objetivo = normalizarNombre(sede);
  if (!objetivo) return null;

  const { data: locations, error } = await supabase
    .from("locations")
    .select("id, name, checklist_sede");

  if (error) {
    console.error("No se pudo leer locations:", error.message);
    return null;
  }

  const candidatos = (locations || []) as {
    id: string;
    name: string;
    checklist_sede: string | null;
  }[];

  // 1) La hoja se llama igual que la sede.
  const exacto = candidatos.find((l) => normalizarNombre(l.name) === objetivo);
  if (exacto) return exacto;

  // 2) La columna del vínculo. Se prefiere esta sobre el nombre porque las
  //    21 sedes comparten muchos prefijos ("San Cristobal ...", "RTP
  //    Ayacucho", "BA Policlinico Ayacucho"): dos pueden diferir solo en la
  //    última palabra y el nombre no alcanza para distinguirlas.
  const porColumna = candidatos.filter((l) => normalizarNombre(l.checklist_sede || "") === objetivo);
  if (porColumna.length === 1) return porColumna[0];

  if (porColumna.length > 1) {
    console.error(
      `Sede "${sede}" mapeada a ${porColumna.length} registros de locations ` +
      `(${porColumna.map((c) => c.name).join(" | ")}). Corregir checklist_sede.`,
    );
    return null;
  }

  // 3) Tolerar sufijos en el nombre de la hoja. Se exige una sola sede
  //    declarada para no arrastrar el error a varias.
  const porSufijo = candidatos.filter((l) => {
    const n = normalizarNombre(l.checklist_sede || "");
    if (!n || n.length < MIN_PARTICULA) return false;
    return objetivo.includes(n) || n.includes(objetivo);
  });

  if (porSufijo.length === 1) return porSufijo[0];

  if (porSufijo.length > 1) {
    console.error(
      `Sede "${sede}" ambigua: coincide con ${porSufijo.length} sedes declaradas. No se vincula.`,
    );
    return null;
  }

  console.warn(
    `Sede "${sede}" sin vincular. Correr la migración 20260925000004 o ` +
    `setear locations.checklist_sede para esa sede.`,
  );

  return null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ error: "Método no permitido. Usa POST." }, 405);
  }

  try {
    // ── 1. Autenticación por clave compartida ──
    const expectedKey = Deno.env.get("CHECKLIST_INGEST_KEY");
    if (!expectedKey) {
      console.error("CHECKLIST_INGEST_KEY no está configurada en la Edge Function.");
      return json({ error: "Servidor misconfigured: falta CHECKLIST_INGEST_KEY." }, 500);
    }

    const providedKey = req.headers.get("x-api-key");
    if (!providedKey || providedKey !== expectedKey) {
      console.warn("Intento de ingesta rechazado: x-api-key inválida.");
      return json({ error: "No autorizado." }, 401);
    }

    // ── 2. Validación del payload ──
    const payload = (await req.json()) as IngestPayload;

    if (!payload.sede || typeof payload.sede !== "string") {
      return json({ error: "El campo 'sede' es obligatorio." }, 400);
    }

    const fecha = normalizarFecha(String(payload.fecha || ""));
    if (!fecha) {
      return json(
        { error: "Fecha inválida. Usa 'YYYY-MM-DD' o 'DD-MM-YYYY'." },
        400,
      );
    }

    if (!Array.isArray(payload.observaciones)) {
      return json({ error: "El campo 'observaciones' debe ser un arreglo." }, 400);
    }

    const sede = payload.sede.trim();
    const origen = (payload.origen || "google-apps-script").trim();

    // Descarta entradas sin sección o sin comentario, y recorta el texto.
    const secciones = payload.observaciones
      .filter((o) => o && o.seccion && o.comentario)
      .map((o) => ({
        bloque: (o.bloque || "COMENTARIOS").trim(),
        seccion: String(o.seccion).trim(),
        comentario: String(o.comentario).trim(),
      }));

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
      return json({ error: "Servidor misconfigured: credenciales de Supabase ausentes." }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ── 3. Resolver a qué sede pertenece ──
    const sedeResuelta = await resolverLocationId(supabase, sede);

    if (!sedeResuelta) {
      console.warn(
        `Sin coincidencia en locations para la sede "${sede}". Se guarda sin vincular: solo gerencia la verá.`,
      );
    } else if (normalizarNombre(sedeResuelta.name) !== normalizarNombre(sede)) {
      console.log(`Sede "${sede}" vinculada a locations."${sedeResuelta.name}"`);
    }

    // ── 4. Modo prueba: valida todo y no toca la base ──
    // Sirve para las 8 copias del script: el supervisor verifica que la clave
    // y los rangos están bien SIN ensuciar los datos.
    if (payload.dry_run) {
      return json({
        success: true,
        dry_run: true,
        sede,
        fecha,
        sede_vinculada: sedeResuelta?.name ?? null,
        secciones_detectadas: secciones.length,
        secciones: secciones.map((s) => `${s.bloque} / ${s.seccion}`),
      });
    }

    // ── 5. Reemplazo del set de la sede para esa fecha ──
    const { error: errorBorrado } = await supabase
      .from("checklist_observaciones")
      .delete()
      .eq("sede", sede)
      .eq("fecha", fecha);

    if (errorBorrado) throw errorBorrado;

    if (secciones.length === 0) {
      console.log(`Ingesta vacía para ${sede} (${fecha}). Se limpiaron los registros previos.`);
      return json({ success: true, sede, fecha, insertados: 0 });
    }

    // El índice único es (sede, fecha, bloque, seccion). Cuando dos renglones
    // de la hoja caen bajo la misma etiqueta —porque la celda está combinada,
    // o porque la sección quedó vacía— el INSERT completo revienta con 23505
    // y no se guarda nada. Se colapsan en una fila por clave
    // concatenando el texto, que además es lo correcto: son el mismo ítem del
    // checklist, no dos comentarios distintos.
    const porClave = new Map<string, { bloque: string; seccion: string; comentario: string }>();
    const colisiones: string[] = [];

    for (const s of secciones) {
      const seccion = String(s.seccion ?? "").trim();
      const clave = `${s.bloque}|${seccion}`;
      const previa = porClave.get(clave);

      if (previa) {
        colisiones.push(`${s.bloque} / ${seccion || "(sin etiqueta)"}`);
        if (s.comentario && !previa.comentario.includes(s.comentario)) {
          previa.comentario = previa.comentario
            ? `${previa.comentario} | ${s.comentario}`
            : s.comentario;
        }
        continue;
      }

      porClave.set(clave, {
        bloque: s.bloque,
        seccion,
        comentario: String(s.comentario ?? ""),
      });
    }

    if (colisiones.length > 0) {
      console.log(
        `Secciones duplicadas combinadas en ${sede} (${fecha}): ${colisiones.join(" ; ")}`,
      );
    }

    const locationId = sedeResuelta?.id ?? null;

    const filas = Array.from(porClave.values()).map((s) => ({
      sede,
      location_id: locationId,
      fecha,
      bloque: s.bloque,
      seccion: s.seccion,
      comentario: s.comentario,
      origen,
    }));

    const { error: errorInsercion } = await supabase
      .from("checklist_observaciones")
      .insert(filas);

    if (errorInsercion) {
      console.error(`Fallo al insertar ${sede} (${fecha}):`, errorInsercion);
      throw new Error(
        `No se pudieron guardar las observaciones (${errorInsercion.code ?? "sin codigo"}). ` +
        `Revisa que las etiquetas de cada bloque sean unicas en la hoja.`,
      );
    }

    console.log(
      `Ingesta OK — sede=${sede} → locations."${sedeResuelta?.name ?? "∅"}" fecha=${fecha} secciones=${filas.length}`,
    );

    return json({
      success: true,
      sede,
      fecha,
      sede_vinculada: sedeResuelta?.name ?? null,
      insertados: filas.length,
      secciones: filas.map((f) => f.seccion),
      secciones_combinadas: colisiones,
    });
  } catch (error: any) {
    console.error("Error en checklist-ingest:", error);
    return json({ error: error.message || "Error desconocido" }, 500);
  }
});
