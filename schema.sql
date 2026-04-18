-- ============================================================
-- EXTENSÕES
-- ============================================================
create extension if not exists "uuid-ossp";
create extension if not exists "postgis"; -- para cálculo de distância GPS

-- ============================================================
-- OPERATORS (usuários da plataforma web)
-- ============================================================
create type operator_role as enum ('admin', 'supervisor', 'agent');

create table operators (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role operator_role not null default 'agent',
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- VICTIMS (vítimas cadastradas pelos operadores)
-- ============================================================
create table victims (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  birth_date date,
  cpf text unique,
  phone text,
  email text,
  address text,
  photo_url text,
  notes text,
  created_by uuid references operators(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- OFFENDERS (agressores cadastrados pelos operadores)
-- ============================================================
create table offenders (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  birth_date date,
  cpf text unique,
  phone text,
  address text,
  photo_url text,
  notes text,
  created_by uuid references operators(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- CASES (vínculo agressor ↔ vítima)
-- ============================================================
create type case_status as enum ('active', 'suspended', 'closed');
create type alert_level as enum ('green', 'yellow', 'red');

create table cases (
  id uuid primary key default uuid_generate_v4(),
  victim_id uuid not null references victims(id) on delete restrict,
  offender_id uuid not null references offenders(id) on delete restrict,
  court_order_number text,                        -- número da ordem judicial
  perimeter_meters integer not null default 300,  -- raio em metros
  status case_status not null default 'active',
  current_alert_level alert_level not null default 'green',
  assigned_operator_id uuid references operators(id),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- TRUSTED CONTACTS (contatos de confiança da vítima)
-- ============================================================
create table trusted_contacts (
  id uuid primary key default uuid_generate_v4(),
  victim_id uuid not null references victims(id) on delete cascade,
  full_name text not null,
  phone text not null,
  relationship text,  -- ex: "mãe", "irmã", "vizinha"
  created_at timestamptz not null default now()
);

-- ============================================================
-- DEVICES (tornozeleiras e smartwatches)
-- ============================================================
create type device_type as enum ('ankle_bracelet', 'smartwatch', 'mobile');
create type device_status as enum ('online', 'offline', 'tampered', 'low_battery');

create table devices (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid not null references cases(id) on delete cascade,
  device_type device_type not null,
  serial_number text unique,
  fcm_token text,           -- token para notificações push
  last_seen_at timestamptz,
  status device_status not null default 'offline',
  battery_level integer,    -- 0 a 100
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- LOCATIONS (histórico de posições GPS)
-- ============================================================
create table locations (
  id bigserial primary key,
  device_id uuid not null references devices(id) on delete cascade,
  case_id uuid not null references cases(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy_meters float,
  recorded_at timestamptz not null default now()
);

-- índice para buscar últimas posições por device rapidamente
create index idx_locations_device_recorded on locations(device_id, recorded_at desc);
create index idx_locations_case_recorded on locations(case_id, recorded_at desc);

-- ============================================================
-- ALERTS (alertas gerados pelo backend)
-- ============================================================
create type alert_type as enum (
  'perimeter_breach',   -- agressor entrou no perímetro
  'signal_lost',        -- dispositivo perdeu sinal
  'device_tampered',    -- dispositivo removido ou danificado
  'panic_button'        -- botão de pânico acionado
);

create type alert_status as enum ('active', 'acknowledged', 'resolved');

create table alerts (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid not null references cases(id) on delete cascade,
  alert_type alert_type not null,
  alert_level alert_level not null,
  status alert_status not null default 'active',
  distance_meters float,          -- distância no momento do alerta
  offender_latitude double precision,
  offender_longitude double precision,
  victim_latitude double precision,
  victim_longitude double precision,
  acknowledged_by uuid references operators(id),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_alerts_case_created on alerts(case_id, created_at desc);
create index idx_alerts_status on alerts(status) where status = 'active';

-- ============================================================
-- POLICE ACTIONS (acionamentos policiais)
-- ============================================================
create table police_actions (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid not null references cases(id) on delete cascade,
  alert_id uuid references alerts(id),
  triggered_by uuid references operators(id),
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- OPERATOR LOGS (auditoria de ações dos operadores)
-- ============================================================
create table operator_logs (
  id bigserial primary key,
  operator_id uuid references operators(id),
  action text not null,       -- ex: "case.created", "alert.acknowledged"
  target_table text,
  target_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_operator_logs_operator on operator_logs(operator_id, created_at desc);