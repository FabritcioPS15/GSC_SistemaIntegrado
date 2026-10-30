-- ═══════════════════════════════════════════════════════════════════════════
-- SISTEMA DE INVENTARIO - GRUPO SAN CRISTÓBAL
-- ESQUEMA CONSOLIDADO Y UNIFICADO
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Este archivo reemplaza a TODAS las migraciones anteriores (movidas a
-- supabase/migrations_legacy/). Es idempotente: se puede ejecutar sobre una
-- base de datos nueva (crea todo desde cero) o sobre una existente (no
-- duplica nada, solo agrega lo que falte).
--
-- Contenido:
--   0.  Extensiones
--   1.  Funciones utilitarias
--   2.  Tablas base (empresas, sedes, usuarios, activos)
--   3.  Inventario (categorías, subcategorías, áreas, movimientos)
--   4.  Infraestructura (servidores, cámaras, DVR, discos, credenciales)
--   5.  Mantenimiento y vehiculos
--   6.  SUTRAN y auditorías
--   7.  Mesa de ayuda (tickets)
--   8.  Notificaciones y mensajería
--   9.  Documentos (planos, títulos)
--  10.  Checklist
--  11.  Solicitudes, envíos, cotizaciones, repuestos
--  12.  Constraints e índices adicionales
--  13.  Funciones de negocio, triggers y vistas
--  14.  Row Level Security (RLS) y permisos
--  15.  Datos semilla (catálogos)
--  16.  Migraciones de datos (compatibilidad)
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 0. EXTENSIONES
-- ═══════════════════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. FUNCIONES UTILITARIAS
-- ═══════════════════════════════════════════════════════════════════════════

-- Actualiza updated_at en cada UPDATE
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Mantiene updated_at de las observaciones de checklist
CREATE OR REPLACE FUNCTION public.touch_checklist_observaciones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. TABLAS BASE
-- ═══════════════════════════════════════════════════════════════════════════

-- Empresas
CREATE TABLE IF NOT EXISTS public.companies (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL UNIQUE,
    ruc         TEXT UNIQUE,
    address     TEXT,
    phone       TEXT,
    email       TEXT,
    logo_url    TEXT,
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Tipos de activo
CREATE TABLE IF NOT EXISTS public.asset_types (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Sedes / ubicaciones
CREATE TABLE IF NOT EXISTS public.locations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    type            TEXT CHECK (type IN ('revision', 'policlinico', 'escuela_conductores', 'central', 'circuito')),
    address         TEXT,
    notes           TEXT,
    region          TEXT CHECK (region IN ('lima', 'provincia')),
    checklist_url   TEXT,
    history_url     TEXT,
    company_id      UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    business_type   TEXT,
    is_active       BOOLEAN DEFAULT true,
    checklist_sede  TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Usuarios (autenticación propia, no Supabase Auth)
CREATE TABLE IF NOT EXISTS public.users (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name    TEXT,
    email        TEXT UNIQUE NOT NULL,
    password     TEXT,
    role         TEXT DEFAULT 'administradores'
                 CHECK (role IN ('super_admin', 'gerencia', 'sistemas', 'supervisores',
                                 'administradores', 'personalizado', 'area_legal', 'area_contable')),
    location_id  UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    phone        TEXT,
    status       TEXT DEFAULT 'active',
    notes        TEXT,
    dni          TEXT,
    permissions  TEXT[],
    avatar_url   TEXT,
    username     TEXT UNIQUE,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Acceso múltiple de usuarios a sedes
CREATE TABLE IF NOT EXISTS public.user_locations (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    location_id  UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    created_by   UUID REFERENCES public.users(id),
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, location_id)
);

-- Áreas dentro de una sede
CREATE TABLE IF NOT EXISTS public.areas (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id  UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    description  TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (location_id, name)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. INVENTARIO
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.categories (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL UNIQUE,
    slug        TEXT NOT NULL UNIQUE,
    icon        TEXT,
    description TEXT,
    sort_order  INTEGER DEFAULT 0,
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.subcategories (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id  UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    slug         TEXT NOT NULL,
    description  TEXT,
    sort_order   INTEGER DEFAULT 0,
    is_active    BOOLEAN DEFAULT true,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (category_id, name),
    UNIQUE (category_id, slug)
);

-- Activos (equipos / inventario)
CREATE TABLE IF NOT EXISTS public.assets (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_type_id         UUID REFERENCES public.asset_types(id),
    location_id           UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    company_id            UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    category_id           UUID REFERENCES public.categories(id),
    subcategory_id        UUID REFERENCES public.subcategories(id),
    area_id               UUID REFERENCES public.areas(id),
    brand                 TEXT,
    model                 TEXT,
    serial_number         TEXT,
    anydesk_id            TEXT,
    ip_address            TEXT,
    phone_number          TEXT,
    camera_url            TEXT,
    camera_username       TEXT,
    camera_password       TEXT,
    capacity              TEXT,
    status                TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance', 'extracted')),
    notes                 TEXT,
    item                  TEXT,
    descripcion           TEXT,
    unidad_medida         TEXT DEFAULT 'UNIDADES',
    cantidad              INTEGER DEFAULT 1,
    condicion             TEXT DEFAULT 'Nuevo',
    color                 TEXT,
    gama                  TEXT,
    fecha_adquisicion     DATE,
    valor_estimado        NUMERIC(12,2),
    estado_uso            TEXT DEFAULT 'Operativo',
    processor             TEXT,
    ram                   TEXT,
    operating_system      TEXT,
    bios_mode             TEXT,
    area                  TEXT,
    placa                 TEXT,
    name                  TEXT,
    url                   TEXT,
    username              TEXT,
    password              TEXT,
    port                  TEXT,
    access_type           TEXT CHECK (access_type IN ('url', 'ivms', 'esviz')),
    auth_code             TEXT,
    imei                  TEXT,
    operator              TEXT,
    data_plan             TEXT,
    physical_condition    TEXT,
    sistema_operativo     TEXT,
    version_so            TEXT,
    almacenamiento        TEXT,
    bateria_estado        TEXT,
    accesorios            TEXT,
    tipo_impresion        TEXT,
    tecnologia_impresion  TEXT,
    velocidad_impresion   TEXT,
    resolucion            TEXT,
    "tamaño_pantalla"     TEXT,
    resolucion_pantalla   TEXT,
    tipo_conexion         TEXT,
    luminosidad           TEXT,
    descripcion_otros     TEXT,
    categoria_otros       TEXT,
    estado_fisico_otros   TEXT,
    material_otros        TEXT,
    dimensiones_otros     TEXT,
    peso_otros            TEXT,
    valor_comercial_otros TEXT,
    proveedor_otros       TEXT,
    fecha_compra_otros    TEXT,
    garantia_otros        TEXT,
    numero_factura_otros  TEXT,
    codigo_unico          TEXT UNIQUE,
    mac_address           TEXT,
    potencia_w            NUMERIC,
    estabilizador_w       NUMERIC,
    voltage_v             NUMERIC,
    frecuencia_hz         NUMERIC,
    brillo_lumens         NUMERIC,
    velocidad_internet    TEXT,
    tipo_conector         TEXT,
    marca_motor           TEXT,
    area_ubicacion        TEXT,
    campos_especificos    JSONB DEFAULT '{}'::jsonb,
    tipo_activo           TEXT,
    responsable_asignado  TEXT,
    proveedor             TEXT,
    garantia_hasta        DATE,
    image_url             TEXT,
    is_deleted            BOOLEAN DEFAULT false,
    deleted_at            TIMESTAMPTZ,
    deleted_by            UUID REFERENCES auth.users(id),
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Movimientos de inventario
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id               UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    type                   TEXT NOT NULL,
    origin_location_id     UUID REFERENCES public.locations(id),
    origin_area_id         UUID REFERENCES public.areas(id),
    destination_location_id UUID REFERENCES public.locations(id),
    destination_area_id    UUID REFERENCES public.areas(id),
    quantity               INTEGER DEFAULT 1,
    reason                 TEXT,
    performed_by           UUID REFERENCES auth.users(id),
    movement_date          TIMESTAMPTZ DEFAULT NOW(),
    created_at             TIMESTAMPTZ DEFAULT NOW()
);

-- Bitácora de cambios
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action       TEXT,
    entity_type  TEXT,
    entity_id    UUID,
    details      JSONB,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. INFRAESTRUCTURA
-- ═══════════════════════════════════════════════════════════════════════════

-- Vehículos
CREATE TABLE IF NOT EXISTS public.vehiculos (
    id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    placa                     TEXT NOT NULL UNIQUE,
    marca                     TEXT NOT NULL,
    modelo                    TEXT NOT NULL,
    "año"                     INTEGER NOT NULL,
    tipo_combustible          TEXT NOT NULL DEFAULT 'gasolina',
    kilometraje               DOUBLE PRECISION NOT NULL DEFAULT 0,
    estado                    TEXT NOT NULL DEFAULT 'disponible'
                              CHECK (estado IN ('disponible', 'en_uso', 'en_mantenimiento', 'inactivo')),
    ubicacion_actual          UUID REFERENCES public.locations(id),
    fecha_ultimo_mantenimiento TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notas                     TEXT,
    imagen_url                TEXT,
    color                     TEXT,
    image_position            TEXT DEFAULT 'center',
    categoria                 TEXT,
    citv_emision              DATE,
    citv_vencimiento          DATE,
    soat_emision              DATE,
    soat_vencimiento          DATE,
    poliza_emision            DATE,
    poliza_vencimiento        DATE,
    contrato_alquiler_emision DATE,
    contrato_alquiler_vencimiento DATE,
    created_at                TIMESTAMPTZ DEFAULT NOW(),
    updated_at                TIMESTAMPTZ DEFAULT NOW()
);

-- Tipos de vehículo (usado por RLS/tablas complementarias)
CREATE TABLE IF NOT EXISTS public.vehicle_types (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Servidores
CREATE TABLE IF NOT EXISTS public.servers (
    id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                     TEXT NOT NULL,
    location_id              UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    ip_address               TEXT,
    anydesk_id               TEXT,
    username                 TEXT,
    password                 TEXT,
    anydesk_password         TEXT,
    backup_scanner_password  TEXT,
    notes                    TEXT,
    created_at               TIMESTAMPTZ DEFAULT NOW(),
    updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- Credenciales por servidor
CREATE TABLE IF NOT EXISTS public.server_credentials (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id  UUID REFERENCES public.servers(id) ON DELETE CASCADE,
    label      TEXT NOT NULL,
    username   TEXT,
    password   TEXT,
    notes      TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credenciales polimórficas (servidores, MTC, activos)
CREATE TABLE IF NOT EXISTS public.resource_credentials (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_id    UUID NOT NULL,
    resource_type  TEXT NOT NULL,
    label          TEXT NOT NULL,
    username       TEXT,
    password       TEXT,
    notes          TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Accesos MTC
CREATE TABLE IF NOT EXISTS public.mtc_accesos (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    url         TEXT NOT NULL,
    username    TEXT,
    password    TEXT,
    access_type TEXT,
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Cámaras
CREATE TABLE IF NOT EXISTS public.cameras (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                 TEXT NOT NULL,
    location_id          UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    url                  TEXT NOT NULL,
    username             TEXT,
    password             TEXT,
    ip_address           TEXT,
    port                 TEXT,
    brand                TEXT,
    model                TEXT,
    status               TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    notes                TEXT,
    access_type          TEXT CHECK (access_type IN ('url', 'ivms', 'esviz')),
    auth_code            TEXT,
    display_count        INTEGER DEFAULT 0,
    recording_start_date TIMESTAMPTZ,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Discos de cámara
CREATE TABLE IF NOT EXISTS public.camera_disks (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    camera_id             UUID REFERENCES public.cameras(id) ON DELETE CASCADE,
    disk_number           INTEGER NOT NULL,
    total_capacity_gb     NUMERIC(10,2),
    remaining_capacity_gb NUMERIC(10,2),
    used_space_gb         NUMERIC(10,2),
    disk_type             TEXT CHECK (disk_type IN ('HDD', 'SSD', 'NVMe', 'Other')),
    status                TEXT DEFAULT 'active' CHECK (status IN ('active', 'full', 'error', 'maintenance')),
    brand                 TEXT,
    serial_number         TEXT,
    stored_from           DATE,
    stored_to             DATE,
    notes                 TEXT,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Discos almacenados (extraídos)
CREATE TABLE IF NOT EXISTS public.stored_disks (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    camera_id             UUID REFERENCES public.cameras(id),
    brand                 TEXT,
    serial_number         TEXT,
    disk_type             TEXT CHECK (disk_type IN ('HDD', 'SSD', 'NVMe', 'Other')),
    disk_number           INTEGER,
    total_capacity_gb     NUMERIC NOT NULL DEFAULT 0,
    used_space_gb         NUMERIC NOT NULL DEFAULT 0,
    remaining_capacity_gb NUMERIC NOT NULL DEFAULT 0,
    stored_from           DATE,
    stored_to             DATE,
    notes                 TEXT,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- DVR
CREATE TABLE IF NOT EXISTS public.dvrs (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                 TEXT NOT NULL,
    sede                 UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    area                 TEXT,
    marca                TEXT NOT NULL,
    modelo               TEXT NOT NULL,
    numero_serie         TEXT,
    canales              TEXT CHECK (canales IN ('4', '8', '16', '32', '64', '128', 'other')),
    resolucion_max       TEXT CHECK (resolucion_max IN ('720p', '1080p', '1440p', '2160p', '4320p', 'other')),
    almacenamiento_total TEXT CHECK (almacenamiento_total IN ('500gb', '1tb', '2tb', '4tb', '8tb', '16tb', '32tb', 'other')),
    discos_instalados    TEXT,
    ip                   TEXT,
    puerto               TEXT,
    usuario              TEXT,
    password             TEXT,
    url_acceso           TEXT,
    estado_fisico        TEXT CHECK (estado_fisico IN ('excelente', 'bueno', 'regular', 'malo', 'danado')),
    notas                TEXT,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. MANTENIMIENTO
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.maintenance_records (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id              UUID REFERENCES public.assets(id) ON DELETE CASCADE,
    maintenance_type      TEXT CHECK (maintenance_type IN ('preventive', 'corrective', 'technical_review', 'repair')),
    status                TEXT DEFAULT 'pending',
    description           TEXT,
    scheduled_date        DATE,
    completed_date        DATE,
    technician            TEXT,
    notes                 TEXT,
    failure_cause         TEXT,
    solution_applied      TEXT,
    work_hours            NUMERIC,
    parts_used            JSONB DEFAULT '[]'::jsonb,
    next_maintenance_date TIMESTAMPTZ,
    maintenance_frequency INTEGER,
    total_cost            NUMERIC DEFAULT 0,
    warranty_claim        BOOLEAN DEFAULT FALSE,
    warranty_details      TEXT,
    location_id           UUID REFERENCES public.locations(id),
    is_active             BOOLEAN DEFAULT true,
    invoice_number        TEXT,
    priority              TEXT,
    labor_cost            NUMERIC,
    service_provider      TEXT,
    other_costs           NUMERIC,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. SUTRAN Y AUDITORÍAS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.sutran_visits (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_date         DATE NOT NULL,
    inspector_name     TEXT NOT NULL,
    inspector_email    TEXT,
    inspector_phone    TEXT,
    location_id        UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    location_name      TEXT NOT NULL,
    visit_type         TEXT DEFAULT 'programada' CHECK (visit_type IN ('programada', 'no_programada', 'de_gabinete')),
    status             TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    observations       TEXT,
    findings           TEXT,
    recommendations    TEXT,
    documents          JSONB DEFAULT '[]'::jsonb,
    evidence_url       TEXT,
    estimated_duration TEXT,
    estimated_cost     NUMERIC(12,2),
    created_by         UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.branch_audits (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id        UUID REFERENCES public.locations(id) ON DELETE CASCADE,
    auditor_name       TEXT NOT NULL,
    administrator_name TEXT,
    audit_date         DATE NOT NULL DEFAULT CURRENT_DATE,
    status             TEXT CHECK (status IN ('excellent', 'good', 'regular', 'critical')),
    score              INTEGER CHECK (score >= 0 AND score <= 100),
    responses          JSONB,
    observations       TEXT,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. MESA DE AYUDA (TICKETS)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.tickets (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title            TEXT NOT NULL,
    description      TEXT,
    priority         TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
    status           TEXT CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'archived')) DEFAULT 'open',
    category         TEXT CHECK (category IN ('hardware', 'software', 'network', 'access', 'other',
                                              'sistemas', 'contable', 'legal', 'operaciones')) DEFAULT 'other',
    requester_id     UUID REFERENCES public.users(id),
    assigned_to      UUID REFERENCES public.users(id),
    location_id      UUID REFERENCES public.locations(id),
    complexity_level TEXT CHECK (complexity_level IS NULL OR complexity_level IN ('N1', 'N2', 'N3')),
    attended_at      TIMESTAMPTZ,
    resolved_at      TIMESTAMPTZ,
    closed_at        TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ticket_comments (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id  UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    user_id    UUID REFERENCES public.users(id),
    content    TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ticket_assignments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id   UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ticket_canned_responses (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title      TEXT NOT NULL,
    content    TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. NOTIFICACIONES Y MENSAJERÍA
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.notifications (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type          TEXT NOT NULL CHECK (type IN ('ticket_created', 'ticket_attended', 'ticket_resolved',
                                                'ticket_closed', 'ticket_mention',
                                                'sutran_visit_scheduled', 'sutran_visit_completed')),
    title         TEXT NOT NULL,
    message       TEXT NOT NULL,
    ticket_id     UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
    user_id       UUID REFERENCES public.users(id) ON DELETE SET NULL,
    user_name     TEXT NOT NULL,
    location_id   UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    location_name TEXT,
    target_role   TEXT NOT NULL CHECK (target_role IN ('super_admin', 'gerencia', 'sistemas',
                                                       'supervisores', 'staff', 'administradores',
                                                       'area_legal', 'area_contable')),
    read          BOOLEAN DEFAULT false NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.conversations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    last_read_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    read_at         TIMESTAMPTZ
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. DOCUMENTOS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.planos_defensa_civil (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre              TEXT NOT NULL,
    tipo                TEXT NOT NULL,
    ubicacion_id        UUID REFERENCES public.locations(id) ON DELETE CASCADE,
    fecha_actualizacion DATE NOT NULL,
    estado              TEXT DEFAULT 'vigente' CHECK (estado IN ('vigente', 'actualizado', 'pendiente')),
    descripcion         TEXT,
    archivo_url         TEXT,
    created_at          TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at          TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.titulos_habilitantes (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo             TEXT NOT NULL,
    tipo               TEXT NOT NULL,
    numero             TEXT NOT NULL,
    fecha_emision      DATE,
    fecha_vencimiento  DATE NOT NULL,
    ubicacion_id       UUID REFERENCES public.locations(id) ON DELETE CASCADE,
    estado             TEXT DEFAULT 'vigente' CHECK (estado IN ('vigente', 'por_vencer', 'vencido')),
    notas              TEXT,
    vigencia_del       DATE,
    vigencia_al        DATE,
    vigencia_documento TEXT,
    dias_para_vencer   INTEGER,
    created_at         TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at         TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. CHECKLIST
-- ═══════════════════════════════════════════════════════════════════════════

-- Observaciones enviadas desde Google Sheets (Edge Function checklist-ingest)
CREATE TABLE IF NOT EXISTS public.checklist_observaciones (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sede        TEXT NOT NULL,
    fecha       DATE NOT NULL DEFAULT current_date,
    bloque      TEXT NOT NULL DEFAULT 'COMENTARIOS',
    seccion     TEXT NOT NULL,
    comentario  TEXT NOT NULL,
    origen      TEXT NOT NULL DEFAULT 'google-apps-script',
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    archivado   BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Respuestas de checklist guardadas desde la app
CREATE TABLE IF NOT EXISTS public.checklist_responses (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_id TEXT NOT NULL,
    user_id      UUID REFERENCES public.users(id),
    location_id  UUID REFERENCES public.locations(id),
    responses    JSONB NOT NULL DEFAULT '{}'::jsonb,
    status       TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'pending')),
    started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT now()
);

-- Plantillas legadas (no usadas por el frontend, RLS bloqueado)
CREATE TABLE IF NOT EXISTS public.checklists (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT,
    type        TEXT,
    description TEXT,
    items       JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.checklist_configs (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id  UUID REFERENCES public.locations(id) ON DELETE CASCADE,
    checklist_id TEXT,
    config       JSONB,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 11. SOLICITUDES, ENVÍOS, COTIZACIONES, REPUESTOS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.requests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title           TEXT NOT NULL,
    description     TEXT NOT NULL,
    category        TEXT NOT NULL CHECK (category IN ('equipamiento', 'mantenimiento', 'software', 'infraestructura', 'otro')),
    priority        TEXT NOT NULL CHECK (priority IN ('baja', 'media', 'alta', 'urgente')),
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    requester_id    UUID REFERENCES public.users(id),
    requester_name  TEXT NOT NULL,
    requester_email TEXT,
    department      TEXT,
    location_id     UUID REFERENCES public.locations(id),
    due_date        DATE,
    estimated_cost  NUMERIC,
    attachments     JSONB DEFAULT '[]'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.requests_approvals (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id   UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
    approver_id  UUID REFERENCES public.users(id),
    approver_name TEXT,
    status       TEXT,
    comments     TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.shipments (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id         UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    from_location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    to_location_id   UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    shipment_date    DATE NOT NULL,
    shipped_by       TEXT,
    received_by      TEXT,
    tracking_number  TEXT,
    carrier          TEXT CHECK (carrier IN ('serpost', 'olva', 'shippo', 'dhl', 'fedex', 'ups', 'local', 'other')),
    status           TEXT NOT NULL DEFAULT 'shipped' CHECK (status IN ('shipped', 'in_transit', 'delivered', 'returned')),
    notes            TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.quotations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    number          TEXT NOT NULL,
    title           TEXT NOT NULL,
    client_name     TEXT NOT NULL,
    client_email    TEXT NOT NULL,
    client_phone    TEXT,
    currency        TEXT NOT NULL DEFAULT 'PEN' CHECK (currency IN ('PEN', 'USD')),
    items           JSONB NOT NULL DEFAULT '[]'::jsonb,
    discount        NUMERIC DEFAULT 0,
    tax_rate        NUMERIC DEFAULT 18,
    notes           TEXT,
    terms           TEXT,
    valid_until     DATE NOT NULL,
    status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected')),
    subtotal        NUMERIC,
    tax_amount      NUMERIC,
    discount_amount NUMERIC,
    total           NUMERIC,
    created_by      UUID REFERENCES public.users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.spare_parts (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name         TEXT NOT NULL,
    description  TEXT NOT NULL,
    part_number  TEXT NOT NULL,
    manufacturer TEXT NOT NULL,
    category     TEXT NOT NULL DEFAULT 'electrical' CHECK (category IN ('electrical', 'mechanical', 'hydraulic',
                                                                       'pneumatic', 'electronic', 'structural',
                                                                       'consumable', 'other')),
    quantity     NUMERIC NOT NULL DEFAULT 1,
    unit         TEXT NOT NULL DEFAULT 'unidad' CHECK (unit IN ('unidad', 'metro', 'kg', 'litro', 'par', 'caja', 'rollo', 'tubo')),
    unit_price   NUMERIC NOT NULL DEFAULT 0,
    min_quantity INTEGER NOT NULL DEFAULT 1,
    location     TEXT,
    supplier     TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_registration_requests (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name      TEXT NOT NULL,
    username       TEXT,
    email          TEXT NOT NULL,
    dni            TEXT,
    phone          TEXT,
    requested_role TEXT,
    notes          TEXT,
    status         TEXT NOT NULL DEFAULT 'pending',
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 12. PARCHES PARA BASES DE DATOS EXISTENTES (idempotente)
--     En una base nueva las columnas ya existen por el CREATE TABLE.
-- ═══════════════════════════════════════════════════════════════════════════

-- users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS dni TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS permissions TEXT[];
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_dni ON public.users(dni) WHERE dni IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON public.users(username) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_permissions ON public.users USING GIN (permissions);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- locations
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS business_type TEXT;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS checklist_sede TEXT;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS checklist_url TEXT;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS history_url TEXT;

-- assets (columnas agregadas después de la creación original)
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id);
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES public.subcategories(id);
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES public.areas(id);
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS codigo_unico TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS mac_address TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS potencia_w NUMERIC;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS estabilizador_w NUMERIC;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS voltage_v NUMERIC;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS frecuencia_hz NUMERIC;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS brillo_lumens NUMERIC;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS velocidad_internet TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS tipo_conector TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS marca_motor TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS descripcion_otros TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS categoria_otros TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS estado_fisico_otros TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS material_otros TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS dimensiones_otros TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS peso_otros TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS valor_comercial_otros TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS proveedor_otros TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS fecha_compra_otros TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS garantia_otros TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS numero_factura_otros TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS campos_especificos JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS tipo_activo TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS responsable_asignado TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS proveedor TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS garantia_hasta DATE;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS area_ubicacion TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS "tamaño_pantalla" TEXT;

-- maintenance_records
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS completed_date DATE;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS technician TEXT;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS failure_cause TEXT;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS solution_applied TEXT;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS work_hours NUMERIC;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS parts_used JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS next_maintenance_date TIMESTAMPTZ;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS maintenance_frequency INTEGER;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS total_cost NUMERIC DEFAULT 0;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS warranty_claim BOOLEAN DEFAULT FALSE;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS warranty_details TEXT;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id);
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS labor_cost NUMERIC;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS service_provider TEXT;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS other_costs NUMERIC;

-- cameras
ALTER TABLE public.cameras ADD COLUMN IF NOT EXISTS display_count INTEGER DEFAULT 0;
ALTER TABLE public.cameras ADD COLUMN IF NOT EXISTS recording_start_date TIMESTAMPTZ;

-- servers
ALTER TABLE public.servers ADD COLUMN IF NOT EXISTS anydesk_password TEXT;
ALTER TABLE public.servers ADD COLUMN IF NOT EXISTS backup_scanner_password TEXT;

-- vehiculos
ALTER TABLE public.vehiculos ADD COLUMN IF NOT EXISTS imagen_url TEXT;
ALTER TABLE public.vehiculos ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE public.vehiculos ADD COLUMN IF NOT EXISTS image_position TEXT DEFAULT 'center';
ALTER TABLE public.vehiculos ADD COLUMN IF NOT EXISTS categoria TEXT;
ALTER TABLE public.vehiculos ADD COLUMN IF NOT EXISTS citv_emision DATE;
ALTER TABLE public.vehiculos ADD COLUMN IF NOT EXISTS citv_vencimiento DATE;
ALTER TABLE public.vehiculos ADD COLUMN IF NOT EXISTS soat_emision DATE;
ALTER TABLE public.vehiculos ADD COLUMN IF NOT EXISTS soat_vencimiento DATE;
ALTER TABLE public.vehiculos ADD COLUMN IF NOT EXISTS poliza_emision DATE;
ALTER TABLE public.vehiculos ADD COLUMN IF NOT EXISTS poliza_vencimiento DATE;
ALTER TABLE public.vehiculos ADD COLUMN IF NOT EXISTS contrato_alquiler_emision DATE;
ALTER TABLE public.vehiculos ADD COLUMN IF NOT EXISTS contrato_alquiler_vencimiento DATE;

-- sutran_visits
ALTER TABLE public.sutran_visits ADD COLUMN IF NOT EXISTS estimated_duration TEXT;
ALTER TABLE public.sutran_visits ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(12,2);
ALTER TABLE public.sutran_visits ADD COLUMN IF NOT EXISTS evidence_url TEXT;

-- categories / subcategories
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.subcategories ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.subcategories ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.subcategories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE public.subcategories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- tickets
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS attended_at TIMESTAMPTZ;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS complexity_level TEXT;
ALTER TABLE public.ticket_comments ALTER COLUMN user_id DROP NOT NULL;

-- notifications (soporte de menciones)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

-- titulos_habilitantes
ALTER TABLE public.titulos_habilitantes ADD COLUMN IF NOT EXISTS vigencia_del DATE;
ALTER TABLE public.titulos_habilitantes ADD COLUMN IF NOT EXISTS vigencia_al DATE;
ALTER TABLE public.titulos_habilitantes ADD COLUMN IF NOT EXISTS vigencia_documento TEXT;
ALTER TABLE public.titulos_habilitantes ADD COLUMN IF NOT EXISTS dias_para_vencer INTEGER;

-- user_registration_requests
ALTER TABLE public.user_registration_requests ADD COLUMN IF NOT EXISTS username TEXT;

-- checklist_observaciones
ALTER TABLE public.checklist_observaciones ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;
ALTER TABLE public.checklist_observaciones ADD COLUMN IF NOT EXISTS archivado BOOLEAN NOT NULL DEFAULT false;

-- ═══════════════════════════════════════════════════════════════════════════
-- 13. CONSTRAINTS, ÍNDICES, FUNCIONES DE NEGOCIO, TRIGGERS Y VISTAS
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Restricciones de dominio ────────────────────────────────────────────────
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS check_user_role;
ALTER TABLE public.users ADD CONSTRAINT check_user_role
    CHECK (role IN ('super_admin', 'gerencia', 'sistemas', 'supervisores',
                    'administradores', 'personalizado', 'area_legal', 'area_contable'));

ALTER TABLE public.locations DROP CONSTRAINT IF EXISTS locations_type_check;
ALTER TABLE public.locations ADD CONSTRAINT locations_type_check
    CHECK (type IN ('revision', 'policlinico', 'escuela_conductores', 'central', 'circuito'));

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'archived'));

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_category_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_category_check
    CHECK (category IN ('hardware', 'software', 'network', 'access', 'other',
                        'sistemas', 'contable', 'legal', 'operaciones'));

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_complexity_level_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_complexity_level_check
    CHECK (complexity_level IS NULL OR complexity_level IN ('N1', 'N2', 'N3'));

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('ticket_created', 'ticket_attended', 'ticket_resolved',
                    'ticket_closed', 'ticket_mention',
                    'sutran_visit_scheduled', 'sutran_visit_completed'));

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_target_role_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_target_role_check
    CHECK (target_role IN ('super_admin', 'gerencia', 'sistemas', 'supervisores', 'staff',
                           'administradores', 'area_legal', 'area_contable'));

ALTER TABLE public.maintenance_records DROP CONSTRAINT IF EXISTS maintenance_records_maintenance_type_check;
ALTER TABLE public.maintenance_records ADD CONSTRAINT maintenance_records_maintenance_type_check
    CHECK (maintenance_type IN ('preventive', 'corrective', 'technical_review', 'repair'));

ALTER TABLE public.sutran_visits DROP CONSTRAINT IF EXISTS sutran_visits_visit_type_check;
ALTER TABLE public.sutran_visits ADD CONSTRAINT sutran_visits_visit_type_check
    CHECK (visit_type IN ('programada', 'no_programada', 'de_gabinete'));

-- ── Índices ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_locations_company_id ON public.locations(company_id);
CREATE INDEX IF NOT EXISTS idx_locations_checklist_sede ON public.locations(checklist_sede) WHERE checklist_sede IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_locations_user_id ON public.user_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_location_id ON public.user_locations(location_id);
CREATE INDEX IF NOT EXISTS idx_assets_location ON public.assets(location_id);
CREATE INDEX IF NOT EXISTS idx_assets_company_id ON public.assets(company_id);
CREATE INDEX IF NOT EXISTS idx_assets_category_id ON public.assets(category_id);
CREATE INDEX IF NOT EXISTS idx_assets_subcategory_id ON public.assets(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_assets_is_deleted ON public.assets(is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_assets_condicion ON public.assets(condicion);
CREATE INDEX IF NOT EXISTS idx_assets_estado_uso ON public.assets(estado_uso);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);
CREATE INDEX IF NOT EXISTS idx_subcategories_category_id ON public.subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_slug ON public.subcategories(slug);
CREATE INDEX IF NOT EXISTS idx_vehicles_ubicacion ON public.vehiculos(ubicacion_actual);
CREATE INDEX IF NOT EXISTS idx_servers_location ON public.servers(location_id);
CREATE INDEX IF NOT EXISTS idx_servers_name ON public.servers(name);
CREATE INDEX IF NOT EXISTS idx_server_credentials_server ON public.server_credentials(server_id);
CREATE INDEX IF NOT EXISTS idx_res_creds_lookup ON public.resource_credentials(resource_id, resource_type);
CREATE INDEX IF NOT EXISTS idx_cameras_location ON public.cameras(location_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_asset ON public.maintenance_records(asset_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_records_asset_id ON public.maintenance_records(asset_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_records_is_active ON public.maintenance_records(is_active);
CREATE INDEX IF NOT EXISTS idx_sutran_visits_date ON public.sutran_visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_sutran_visits_status ON public.sutran_visits(status);
CREATE INDEX IF NOT EXISTS idx_sutran_visits_location ON public.sutran_visits(location_id);
CREATE INDEX IF NOT EXISTS idx_tickets_requester ON public.tickets(requester_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON public.tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_closed_at ON public.tickets(closed_at);
CREATE INDEX IF NOT EXISTS idx_tickets_complexity_level ON public.tickets(complexity_level);
CREATE INDEX IF NOT EXISTS idx_tickets_category_complexity_level ON public.tickets(category, complexity_level);
CREATE INDEX IF NOT EXISTS idx_notifications_target_role ON public.notifications(target_role);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user ON public.conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation ON public.conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_checklist_observaciones_unico ON public.checklist_observaciones(sede, fecha, bloque, seccion);
CREATE INDEX IF NOT EXISTS idx_checklist_observaciones_fecha ON public.checklist_observaciones(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_checklist_observaciones_sede ON public.checklist_observaciones(sede);
CREATE INDEX IF NOT EXISTS idx_checklist_observaciones_location ON public.checklist_observaciones(location_id);
CREATE INDEX IF NOT EXISTS idx_checklist_observaciones_sede_fecha ON public.checklist_observaciones(sede, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_checklist_observaciones_vivas ON public.checklist_observaciones(fecha DESC, sede) WHERE archivado = false;

-- ── Funciones de negocio ─────────────────────────────────────────────────────

-- Solo puede existir un super_admin
CREATE OR REPLACE FUNCTION public.check_super_admin_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role = 'super_admin' THEN
        IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.role <> 'super_admin') THEN
            IF EXISTS (
                SELECT 1 FROM public.users
                WHERE role = 'super_admin'
                  AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
            ) THEN
                RAISE EXCEPTION 'Solo puede existir un usuario con el rol Super Administrador';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Evita resetear la contraseña con valores vacíos
CREATE OR REPLACE FUNCTION public.protect_user_password()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.password IS NULL OR NEW.password = '' THEN
            NEW.password := OLD.password;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Impide borrar activos con mantenimiento activo
CREATE OR REPLACE FUNCTION public.check_active_maintenance_records()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.maintenance_records
        WHERE asset_id = OLD.id AND is_active = true
    ) THEN
        RAISE EXCEPTION 'No se puede eliminar el activo porque tiene registros de mantenimiento activos. Por favor, desactive los registros de mantenimiento primero.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Soft delete de activos
CREATE OR REPLACE FUNCTION public.soft_delete_asset()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.maintenance_records
        WHERE asset_id = OLD.id AND is_active = true
    ) THEN
        RAISE EXCEPTION 'No se puede eliminar el activo porque tiene registros de mantenimiento activos. Por favor, desactive los registros de mantenimiento primero.';
    END IF;
    NEW.is_deleted = true;
    NEW.deleted_at = NOW();
    NEW.deleted_by = auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Actualiza la conversación al recibir un mensaje
CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.conversations SET updated_at = NOW() WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Limpieza de notificaciones antiguas
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS void AS $$
BEGIN
    DELETE FROM public.notifications WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Estadísticas por categoría
CREATE OR REPLACE FUNCTION public.get_asset_statistics_by_category(p_company_id UUID DEFAULT NULL)
RETURNS TABLE (
    category_id UUID,
    category_name TEXT,
    category_slug TEXT,
    total_assets BIGINT,
    active_assets BIGINT,
    maintenance_assets BIGINT,
    inactive_assets BIGINT,
    total_value NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id, c.name, c.slug,
        COUNT(a.id),
        COUNT(a.id) FILTER (WHERE a.status = 'active'),
        COUNT(a.id) FILTER (WHERE a.status = 'maintenance'),
        COUNT(a.id) FILTER (WHERE a.status = 'inactive'),
        COALESCE(SUM(a.purchase_price), 0)
    FROM public.categories c
    LEFT JOIN public.assets a ON a.category_id = c.id AND a.is_deleted = false
    WHERE (p_company_id IS NULL OR a.company_id = p_company_id)
    GROUP BY c.id, c.name, c.slug
    ORDER BY c.sort_order, c.name;
END;
$$ LANGUAGE plpgsql;

-- Estadísticas de mantenimiento por activo
CREATE OR REPLACE FUNCTION public.get_maintenance_statistics_by_asset(p_asset_id UUID)
RETURNS TABLE (
    total_maintenance_records BIGINT,
    active_maintenance_records BIGINT,
    completed_maintenance_records BIGINT,
    total_maintenance_cost NUMERIC,
    last_maintenance_date TIMESTAMPTZ,
    next_maintenance_date TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'in_progress' OR status = 'pending'),
        COUNT(*) FILTER (WHERE status = 'completed'),
        COALESCE(SUM(total_cost), 0),
        MAX(completed_date) FILTER (WHERE completed_date IS NOT NULL),
        MAX(next_maintenance_date) FILTER (WHERE next_maintenance_date IS NOT NULL)
    FROM public.maintenance_records
    WHERE asset_id = p_asset_id;
END;
$$ LANGUAGE plpgsql;

-- ── Triggers ─────────────────────────────────────────────────────────────────

-- updated_at en las tablas que tienen esa columna
DO $$
DECLARE
    t TEXT;
    tablas TEXT[] := ARRAY[
        'companies', 'locations', 'users', 'areas', 'categories', 'subcategories',
        'assets', 'vehiculos', 'servers', 'server_credentials', 'resource_credentials',
        'mtc_accesos', 'cameras', 'camera_disks', 'stored_disks', 'dvrs',
        'maintenance_records', 'sutran_visits', 'branch_audits', 'tickets',
        'planos_defensa_civil', 'titulos_habilitantes', 'requests', 'shipments',
        'quotations', 'spare_parts', 'checklists', 'checklist_configs'
    ];
BEGIN
    FOREACH t IN ARRAY tablas LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON public.%I', t, t);
        EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t, t);
    END LOOP;
END $$;

-- Checklist observaciones
DROP TRIGGER IF EXISTS trg_checklist_observaciones_updated_at ON public.checklist_observaciones;
CREATE TRIGGER trg_checklist_observaciones_updated_at
    BEFORE UPDATE ON public.checklist_observaciones
    FOR EACH ROW EXECUTE FUNCTION public.touch_checklist_observaciones_updated_at();

-- Super admin único
DROP TRIGGER IF EXISTS enforce_super_admin_limit ON public.users;
CREATE TRIGGER enforce_super_admin_limit
    BEFORE INSERT OR UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.check_super_admin_limit();

-- Protección de contraseña
DROP TRIGGER IF EXISTS protect_user_password_trigger ON public.users;
CREATE TRIGGER protect_user_password_trigger
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.protect_user_password();

-- Soft delete de activos
DROP TRIGGER IF EXISTS prevent_asset_deletion_with_active_maintenance ON public.assets;
DROP TRIGGER IF EXISTS soft_delete_asset_trigger ON public.assets;
CREATE TRIGGER soft_delete_asset_trigger
    BEFORE UPDATE ON public.assets
    FOR EACH ROW
    WHEN (NEW.is_deleted = true AND OLD.is_deleted = false)
    EXECUTE FUNCTION public.soft_delete_asset();

-- Mensajería
DROP TRIGGER IF EXISTS update_conversation_on_message ON public.messages;
CREATE TRIGGER update_conversation_on_message
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.update_conversation_timestamp();

-- ── Vistas ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.assets_with_details AS
SELECT
    a.*,
    c.name AS category_name,
    c.slug AS category_slug,
    s.name AS subcategory_name,
    s.slug AS subcategory_slug,
    l.name AS location_name,
    l.company_id AS location_company_id,
    l.business_type AS location_business_type,
    comp.name AS company_name,
    ar.name AS area_name,
    at.name AS asset_type_name
FROM public.assets a
LEFT JOIN public.categories c ON a.category_id = c.id
LEFT JOIN public.subcategories s ON a.subcategory_id = s.id
LEFT JOIN public.locations l ON a.location_id = l.id
LEFT JOIN public.companies comp ON a.company_id = comp.id
LEFT JOIN public.areas ar ON a.area_id = ar.id
LEFT JOIN public.asset_types at ON a.asset_type_id = at.id
WHERE a.is_deleted = false;

CREATE OR REPLACE VIEW public.user_role_hierarchy AS
SELECT
    id,
    full_name,
    email,
    role,
    CASE role
        WHEN 'super_admin' THEN 1
        WHEN 'gerencia' THEN 2
        WHEN 'sistemas' THEN 3
        WHEN 'supervisores' THEN 4
        WHEN 'administradores' THEN 5
        WHEN 'area_legal' THEN 6
        WHEN 'area_contable' THEN 7
        WHEN 'personalizado' THEN 8
        ELSE 9
    END AS role_level,
    status,
    created_at
FROM public.users
ORDER BY role_level, full_name;

-- ═══════════════════════════════════════════════════════════════════════════
-- 14. ROW LEVEL SECURITY Y PERMISOS
--
-- Nota: la app NO usa Supabase Auth. El login compara la contraseña en el
-- cliente contra public.users, por lo que el rol real de cada petición es
-- `anon`. Por eso las tablas de la app se abren a anon + authenticated.
-- Las tablas sensibles quedan con RLS habilitado y SIN políticas.
-- ═══════════════════════════════════════════════════════════════════════════

-- Habilitar RLS en todas las tablas
DO $$
DECLARE
    t TEXT;
    tablas TEXT[] := ARRAY[
        'companies', 'asset_types', 'locations', 'users', 'user_locations', 'areas',
        'categories', 'subcategories', 'assets', 'inventory_movements', 'audit_logs',
        'vehiculos', 'vehicle_types', 'servers', 'server_credentials', 'resource_credentials',
        'mtc_accesos', 'cameras', 'camera_disks', 'stored_disks', 'dvrs',
        'maintenance_records', 'sutran_visits', 'branch_audits', 'tickets', 'ticket_comments',
        'ticket_assignments', 'ticket_canned_responses', 'notifications', 'conversations',
        'conversation_participants', 'messages', 'planos_defensa_civil', 'titulos_habilitantes',
        'checklist_observaciones', 'checklist_responses', 'checklists', 'checklist_configs',
        'requests', 'requests_approvals', 'shipments', 'quotations', 'spare_parts',
        'user_registration_requests'
    ];
BEGIN
    FOREACH t IN ARRAY tablas LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

-- Políticas abiertas (anon + authenticated) para las tablas que usa el frontend
DO $$
DECLARE
    t TEXT;
    tablas TEXT[] := ARRAY[
        'companies', 'asset_types', 'locations', 'users', 'user_locations', 'areas',
        'categories', 'subcategories', 'assets', 'inventory_movements', 'audit_logs',
        'vehiculos', 'vehicle_types', 'servers', 'resource_credentials', 'mtc_accesos',
        'cameras', 'camera_disks', 'stored_disks', 'dvrs', 'maintenance_records',
        'sutran_visits', 'branch_audits', 'tickets', 'ticket_comments', 'ticket_assignments',
        'ticket_canned_responses', 'notifications', 'conversations', 'conversation_participants',
        'messages', 'planos_defensa_civil', 'titulos_habilitantes', 'checklist_responses',
        'requests', 'requests_approvals', 'shipments', 'quotations', 'spare_parts',
        'user_registration_requests'
    ];
BEGIN
    FOREACH t IN ARRAY tablas LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_allow_all', t);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t || '_allow_all', t);
    END LOOP;
END $$;

-- checklist_observaciones: lectura/actualización/borrado abiertos; INSERT solo service_role
DROP POLICY IF EXISTS checklist_observaciones_select ON public.checklist_observaciones;
CREATE POLICY checklist_observaciones_select ON public.checklist_observaciones
    FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS checklist_observaciones_update ON public.checklist_observaciones;
CREATE POLICY checklist_observaciones_update ON public.checklist_observaciones
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS checklist_observaciones_delete ON public.checklist_observaciones;
CREATE POLICY checklist_observaciones_delete ON public.checklist_observaciones
    FOR DELETE TO anon, authenticated USING (true);

-- server_credentials / checklists / checklist_configs: RLS sin políticas (solo service_role)

-- Permisos base
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;

-- Realtime
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tickets') THEN
            EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ticket_comments') THEN
            EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_comments';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications') THEN
            EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ticket_canned_responses') THEN
            EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_canned_responses';
        END IF;
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 15. DATOS SEMILLA (CATÁLOGOS)
-- ═══════════════════════════════════════════════════════════════════════════

-- Empresas
INSERT INTO public.companies (name, ruc, is_active) VALUES
    ('BREVETES APURIMAC S.A.C.',     '20491204517', true),
    ('MI BREVETE SEGURO S.A.C.',     '20604034893', true),
    ('OFICINA CENTRAL',              NULL,          true),
    ('RTP SAN CRISTOBAL S.A.C.',     '20600065921', true),
    ('RTV SAN CRISTOBAL S.A.C.',     '20608334174', true),
    ('SAN CRISTOBAL DEL PERU S.A.C.','20495109004', true),
    ('SAN CRISTOBAL VIP S.A.C.',     '20600560311', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.companies (name, ruc, is_active)
VALUES ('Grupo San Cristobal', '20123456789', true)
ON CONFLICT (name) DO NOTHING;

-- Tipos de activo
INSERT INTO public.asset_types (name) VALUES
    ('Cámara'), ('Celular'), ('Chip de Celular'), ('Disco de Almacenamiento'),
    ('Disco Extraído'), ('DVR'), ('Escáner'), ('Fuente de Poder'), ('Impresora'),
    ('Laptop'), ('Maquinaria'), ('Memoria RAM'), ('Monitor'), ('PC'), ('Proyector'),
    ('Switch'), ('Tinte')
ON CONFLICT (name) DO NOTHING;

-- Categorías de inventario
INSERT INTO public.categories (name, slug, icon, description, sort_order) VALUES
    ('Tecnología', 'tecnologia', 'laptop', 'Equipos de cómputo, dispositivos electrónicos y redes', 1),
    ('Seguridad y Control', 'seguridad-control', 'shield', 'Sistemas de seguridad, cámaras, biométricos y control de acceso', 2),
    ('Equipos de Línea', 'equipos-operativos', 'wrench', 'Equipos de revisión técnica, médicos y de evaluación', 3),
    ('Mobiliario', 'mobiliario', 'armchair', 'Muebles de oficina, escritorios, sillas y estanterías', 4),
    ('Útiles y Suministros', 'utiles-suministros', 'package', 'Material de oficina, suministros y útiles administrativos', 5),
    ('Otros Activos', 'otros-activos', 'tool', 'Equipos diversos, herramientas y estructuras', 6),
    ('Flota Vehicular', 'flota-vehicular', 'truck', 'Vehículos, maquinaria pesada y equipo de transporte', 7),
    ('Herramientas y Equipos', 'herramientas-equipos', 'wrench', 'Herramientas de trabajo, equipos de taller y consumibles', 8),
    ('Instalaciones', 'instalaciones', 'building', 'Instalaciones eléctricas, sanitarias, climatización y acabados', 9),
    ('Equipos de Revisión (RTV/CITV)', 'equipos-revision', 'clipboard-check', 'Equipos de revisión técnica vehicular: opacímetros, frenómetros, entre otros', 10),
    ('Infraestructura TI', 'infraestructura-ti', 'server', 'Racks, cableado estructurado, servidores y equipamiento de red', 11)
ON CONFLICT DO NOTHING;

-- Subcategorías
INSERT INTO public.subcategories (category_id, name, slug, sort_order)
SELECT c.id, v.name, v.slug, v.sort_order
FROM (VALUES
    -- Tecnología
    ('tecnologia', 'CPU', 'cpu', 1),
    ('tecnologia', 'Laptop', 'laptop', 2),
    ('tecnologia', 'Monitor', 'monitor', 3),
    ('tecnologia', 'Teclado', 'teclado', 4),
    ('tecnologia', 'Mouse', 'mouse', 5),
    ('tecnologia', 'Impresora', 'impresora', 6),
    ('tecnologia', 'Escáner', 'escaner', 7),
    ('tecnologia', 'Servidor', 'servidor', 8),
    ('tecnologia', 'Celular', 'celular', 9),
    ('tecnologia', 'Tablet', 'tablet', 10),
    ('tecnologia', 'TV', 'tv', 11),
    ('tecnologia', 'Proyector', 'proyector', 12),
    ('tecnologia', 'Router', 'router', 13),
    ('tecnologia', 'Switch', 'switch', 14),
    ('tecnologia', 'Teléfono', 'telefono', 15),
    -- Seguridad y Control
    ('seguridad-control', 'Cámaras', 'camaras', 1),
    ('seguridad-control', 'DVR', 'dvr', 2),
    ('seguridad-control', 'NVR', 'nvr', 3),
    ('seguridad-control', 'Biométricos', 'biometricos', 4),
    ('seguridad-control', 'Lectores de huella', 'lectores-huella', 5),
    ('seguridad-control', 'Alarmas', 'alarmas', 6),
    ('seguridad-control', 'Extintores', 'extintores', 7),
    ('seguridad-control', 'Luces de emergencia', 'luces-emergencia', 8),
    -- Equipos de Línea (slug equipos-operativos)
    ('equipos-operativos', 'Analizador de gases', 'analizador-gases', 1),
    ('equipos-operativos', 'Opacímetro', 'opacimetro', 2),
    ('equipos-operativos', 'Frenómetro', 'frenometro', 3),
    ('equipos-operativos', 'Luxómetro', 'luxometro', 4),
    ('equipos-operativos', 'Detector de holguras', 'detector-holguras', 5),
    ('equipos-operativos', 'Medidor de alineación', 'medidor-alineacion', 6),
    ('equipos-operativos', 'Equipos médicos', 'equipos-medicos', 7),
    ('equipos-operativos', 'Equipos de evaluación', 'equipos-evaluacion', 8),
    ('equipos-operativos', 'Equipos especializados', 'equipos-especializados', 9),
    -- Mobiliario
    ('mobiliario', 'Escritorios', 'escritorios', 1),
    ('mobiliario', 'Sillas', 'sillas', 2),
    ('mobiliario', 'Mesas', 'mesas', 3),
    ('mobiliario', 'Bancas', 'bancas', 4),
    ('mobiliario', 'Archivadores', 'archivadores', 5),
    ('mobiliario', 'Estantes', 'estantes', 6),
    ('mobiliario', 'Carpetas', 'carpetas', 7),
    ('mobiliario', 'Módulos', 'modulos', 8),
    ('mobiliario', 'Pizarras', 'pizarras', 9),
    ('mobiliario', 'Muebles', 'muebles', 10),
    -- Útiles y Suministros
    ('utiles-suministros', 'Grapadoras', 'grapadoras', 1),
    ('utiles-suministros', 'Saca grapas', 'saca-grapas', 2),
    ('utiles-suministros', 'Porta lapiceros', 'porta-lapiceros', 3),
    ('utiles-suministros', 'Botiquines', 'botiquines', 4),
    ('utiles-suministros', 'Material de oficina', 'material-oficina', 5),
    ('utiles-suministros', 'Insumos administrativos', 'insumos-administrativos', 6),
    -- Otros Activos
    ('otros-activos', 'Compresoras', 'compresoras', 1),
    ('otros-activos', 'Aspiradoras', 'aspiradoras', 2),
    ('otros-activos', 'Carretillas', 'carretillas', 3),
    ('otros-activos', 'Herramientas', 'herramientas', 4),
    ('otros-activos', 'Estructuras metálicas', 'estructuras-metalicas', 5),
    ('otros-activos', 'Instalaciones especiales', 'instalaciones-especiales', 6),
    -- Flota Vehicular
    ('flota-vehicular', 'Vehículos livianos', 'vehiculos-livianos', 1),
    ('flota-vehicular', 'Camionetas', 'camionetas', 2),
    ('flota-vehicular', 'Vehículos pesados', 'vehiculos-pesados', 3),
    ('flota-vehicular', 'Motocicletas', 'motocicletas', 4),
    ('flota-vehicular', 'Maquinaria pesada', 'maquinaria-pesada', 5),
    ('flota-vehicular', 'Equipos de carga', 'equipos-carga', 6),
    -- Herramientas y Equipos
    ('herramientas-equipos', 'Herramientas Manuales', 'herramientas-manuales', 1),
    ('herramientas-equipos', 'Herramientas Eléctricas', 'herramientas-electricas', 2),
    ('herramientas-equipos', 'Herramientas de Medición', 'herramientas-medicion', 3),
    ('herramientas-equipos', 'Herramientas de Corte', 'herramientas-corte', 4),
    ('herramientas-equipos', 'Equipos de Protección Personal', 'epp', 5),
    -- Instalaciones
    ('instalaciones', 'Iluminación', 'iluminacion', 1),
    ('instalaciones', 'Climatización', 'climatizacion', 2),
    ('instalaciones', 'Plomería', 'plomeria', 3),
    ('instalaciones', 'Eléctrico', 'electrico', 4),
    ('instalaciones', 'Carpintería y Acabados', 'carpinteria-acabados', 5),
    -- Equipos de Revisión (RTV/CITV)
    ('equipos-revision', 'Analizadores de gases', 'analizadores-gases', 1),
    ('equipos-revision', 'Opacímetros', 'opacimetros', 2),
    ('equipos-revision', 'Frenómetros', 'frenometros', 3),
    ('equipos-revision', 'Luxómetros', 'luxometros', 4),
    ('equipos-revision', 'Detectores de holguras', 'detectores-holguras', 5),
    ('equipos-revision', 'Bancos de suspensión', 'bancos-suspension', 6),
    ('equipos-revision', 'Alineadores', 'alineadores', 7),
    ('equipos-revision', 'PIT y fosos', 'pit-fosos', 8),
    -- Infraestructura TI
    ('infraestructura-ti', 'Racks y gabinetes', 'racks-gabinetes', 1),
    ('infraestructura-ti', 'Cableado estructurado', 'cableado-estructurado', 2),
    ('infraestructura-ti', 'Energía y respaldo', 'energia-respaldo', 3),
    ('infraestructura-ti', 'Almacenamiento', 'almacenamiento', 4),
    ('infraestructura-ti', 'Redes inalámbricas', 'redes-inalambricas', 5),
    ('infraestructura-ti', 'Equipamiento de red', 'equipamiento-red', 6)
) AS v(cat_slug, name, slug, sort_order)
JOIN public.categories c ON c.slug = v.cat_slug
ON CONFLICT DO NOTHING;

-- Respuestas rápidas de la mesa de ayuda
INSERT INTO public.ticket_canned_responses (title, content)
SELECT v.title, v.content
FROM (VALUES
    ('Resolución Estándar', 'El problema ha sido resuelto satisfactoriamente. Por favor, verifique el funcionamiento y nos confirma para cerrar el ticket.'),
    ('Solicitud de Información', 'Para poder procesar su solicitud, necesitamos información adicional. ¿Podría proporcionarnos más detalles o capturas de pantalla del error?'),
    ('En Espera de Terceros', 'Hemos escalado su requerimiento al proveedor correspondiente. Le informaremos apenas tengamos una respuesta.'),
    ('Mantenimiento Programado', 'Le informamos que se realizará un mantenimiento programado en los servidores. El servicio podría verse afectado temporalmente.'),
    ('Cierre por Inactividad', 'Debido a que no hemos recibido respuesta en los últimos días, procederemos a cerrar el ticket. Si el problema persiste, puede abrir uno nuevo.')
) AS v(title, content)
WHERE NOT EXISTS (SELECT 1 FROM public.ticket_canned_responses);

-- ═══════════════════════════════════════════════════════════════════════════
-- 16. MIGRACIONES DE DATOS (compatibilidad con datos existentes)
-- ═══════════════════════════════════════════════════════════════════════════

-- Normalización de roles antiguos
UPDATE public.users SET role = 'super_admin'     WHERE role IN ('super_admin', 'root', 'owner');
UPDATE public.users SET role = 'gerencia'        WHERE role IN ('management', 'gerencia', 'manager');
UPDATE public.users SET role = 'sistemas'        WHERE role IN ('systems', 'system', 'it', 'admin');
UPDATE public.users SET role = 'supervisores'    WHERE role IN ('supervisor', 'supervisores', 'lead');
UPDATE public.users SET role = 'administradores' WHERE role IN ('admin', 'administrator', 'user');
UPDATE public.users SET role = 'personalizado'   WHERE role IN ('custom', 'personalizado', 'other');

-- Renombrados de catálogo
UPDATE public.asset_types SET name = 'EQUIPOS DE LÍNEA' WHERE name = 'PC';
UPDATE public.categories  SET name = 'Equipos de Línea' WHERE slug = 'equipos-operativos' OR name = 'Equipos Operativos';

-- Copiar business_type de la empresa a sus sedes (solo si companies.business_type existe)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'business_type'
    ) THEN
        UPDATE public.locations l
        SET business_type = c.business_type
        FROM public.companies c
        WHERE l.company_id = c.id AND c.business_type IS NOT NULL;
    END IF;
END $$;

UPDATE public.locations SET business_type = 'oficinas_administrativas' WHERE business_type IS NULL;

-- Backfill de códigos únicos de activos
UPDATE public.assets
SET codigo_unico = 'ACT-' || LPAD(floor(random() * 1000000)::text, 6, '0')
WHERE codigo_unico IS NULL;

-- Área "General" por sede
INSERT INTO public.areas (location_id, name)
SELECT id, 'General' FROM public.locations
ON CONFLICT (location_id, name) DO NOTHING;

-- Backfill de accesos de usuario a sedes
INSERT INTO public.user_locations (user_id, location_id, created_by)
SELECT id, location_id, id
FROM public.users
WHERE location_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM public.user_locations ul
    WHERE ul.user_id = public.users.id AND ul.location_id = public.users.location_id
);

-- Migración de server_credentials a resource_credentials (si la tabla origen existe)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'server_credentials') THEN
        INSERT INTO public.resource_credentials (resource_id, resource_type, label, username, password, notes, created_at, updated_at)
        SELECT sc.server_id, 'server', sc.label, sc.username, sc.password, sc.notes, sc.created_at, sc.updated_at
        FROM public.server_credentials sc
        WHERE NOT EXISTS (
            SELECT 1 FROM public.resource_credentials rc
            WHERE rc.resource_id = sc.server_id AND rc.resource_type = 'server' AND rc.label = sc.label
        );
    END IF;
END $$;

-- Vinculación de sedes de checklist
UPDATE public.locations SET checklist_sede = 'ESCON MBS ATE'           WHERE name = 'Mi Brevete Seguro ATE';
UPDATE public.locations SET checklist_sede = 'ESCON MBS AYACUCHO'      WHERE name = 'Mi Brevete Seguro Ayacucho';
UPDATE public.locations SET checklist_sede = 'ESCON MBS HUANCAVELICA'  WHERE name = 'Mi Brevete Seguro Huancavelica';
UPDATE public.locations SET checklist_sede = 'ESCON SCVIP CALLAO'      WHERE name = 'San Cristóbal Vip Callao';
UPDATE public.locations SET checklist_sede = 'ESCON SCVIP HUACHO'      WHERE name = 'San Cristóbal Vip Huacho';
UPDATE public.locations SET checklist_sede = 'ESCON SCVIP IZAGUIRRE'   WHERE name = 'San Crístobal Vip Lima';
UPDATE public.locations SET checklist_sede = 'ESCON SCP ICA'           WHERE name = 'San Cristóbal del Perú Ica';
UPDATE public.locations SET checklist_sede = 'ESCON SCP ANDAHUAYLAS'   WHERE name = 'San Cristóbal del Perú Andahuaylas';

-- Datos de ejemplo de SUTRAN (solo si la tabla está vacía)
INSERT INTO public.sutran_visits (
    visit_date, inspector_name, inspector_email, location_name,
    visit_type, status, observations, findings, recommendations, documents
)
SELECT * FROM (VALUES
    ('2024-01-15'::date, 'Juan Pérez', 'juan.perez@sutran.gob.pe', 'Oficina Principal - Lima',
     'programada', 'completed', 'Inspección rutinaria completada sin observaciones',
     'Todas las áreas funcionando correctamente', 'Continuar con el programa de mantenimiento preventivo',
     '["reporte_inspeccion.pdf", "fotos_inspeccion.zip"]'::jsonb),
    ('2024-01-20'::date, 'María González', 'maria.gonzalez@sutran.gob.pe', 'Sede Norte - Trujillo',
     'no_programada', 'pending', 'Pendiente de programar', NULL, NULL, '[]'::jsonb),
    ('2024-01-25'::date, 'Carlos Rodríguez', 'carlos.rodriguez@sutran.gob.pe', 'Sede Sur - Arequipa',
     'de_gabinete', 'completed', 'Se encontraron algunas áreas que requieren mantenimiento',
     'Equipos de comunicación necesitan actualización', 'Programar mantenimiento correctivo para la próxima semana',
     '["reporte_mantenimiento.pdf"]'::jsonb)
) AS v
WHERE NOT EXISTS (SELECT 1 FROM public.sutran_visits);

-- Recargar el cache de esquema de PostgREST
NOTIFY pgrst, 'reload schema';
