-- =====================================================================
-- SEU PET BEM - Petshop Management System Schema (Multi-Tenant)
-- Database: Supabase (PostgreSQL)
-- =====================================================================
-- This schema provides full multi-tenant isolation via Row Level Security.
-- Every business-scoped table uses business_id as the tenant key and is
-- protected by RLS policies that restrict access to rows belonging to
-- the authenticated user's business.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- ENUM types
-- ---------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('owner', 'admin', 'employee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE appointment_status AS ENUM ('scheduled', 'confirmed', 'in_progress', 'done', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('income', 'expense');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM ('whatsapp', 'email', 'sms');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE pet_sex AS ENUM ('male', 'female', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- Helper function: updated_at trigger
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- Helper function: return the business_id of the currently authenticated user
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_business_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT business_id
    FROM public.users
    WHERE id = auth.uid()
    LIMIT 1;
$$;

-- =====================================================================
-- 1. BUSINESSES
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.businesses (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    plan        TEXT NOT NULL DEFAULT 'free',
    owner_id    UUID,
    phone       TEXT,
    address     TEXT,
    logo_url    TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_businesses_slug      ON public.businesses(slug);
CREATE INDEX IF NOT EXISTS idx_businesses_owner_id  ON public.businesses(owner_id);

DROP TRIGGER IF EXISTS trg_businesses_updated_at ON public.businesses;
CREATE TRIGGER trg_businesses_updated_at
BEFORE UPDATE ON public.businesses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- 2. USERS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id           UUID PRIMARY KEY,  -- matches auth.users.id
    business_id  UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    email        TEXT NOT NULL UNIQUE,
    role         user_role NOT NULL DEFAULT 'employee',
    active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_business_id ON public.users(business_id);
CREATE INDEX IF NOT EXISTS idx_users_email       ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role        ON public.users(role);

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add FK from businesses.owner_id -> users.id (circular, added after users exists)
DO $$ BEGIN
    ALTER TABLE public.businesses
        ADD CONSTRAINT fk_businesses_owner
        FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================================
-- 3. CUSTOMERS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.customers (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    phone       TEXT,
    email       TEXT,
    cpf         TEXT,
    address     TEXT,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (business_id, cpf)
);

CREATE INDEX IF NOT EXISTS idx_customers_business_id ON public.customers(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_name        ON public.customers(business_id, name);
CREATE INDEX IF NOT EXISTS idx_customers_phone       ON public.customers(business_id, phone);
CREATE INDEX IF NOT EXISTS idx_customers_email       ON public.customers(business_id, email);

DROP TRIGGER IF EXISTS trg_customers_updated_at ON public.customers;
CREATE TRIGGER trg_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- 4. PETS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.pets (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id  UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    business_id  UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    species      TEXT NOT NULL,
    breed        TEXT,
    birth_date   DATE,
    weight       NUMERIC(6,2),
    sex          pet_sex DEFAULT 'unknown',
    color        TEXT,
    photo_url    TEXT,
    notes        TEXT,
    allergies    TEXT,
    medications  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pets_business_id ON public.pets(business_id);
CREATE INDEX IF NOT EXISTS idx_pets_customer_id ON public.pets(customer_id);
CREATE INDEX IF NOT EXISTS idx_pets_name        ON public.pets(business_id, name);
CREATE INDEX IF NOT EXISTS idx_pets_species     ON public.pets(business_id, species);

DROP TRIGGER IF EXISTS trg_pets_updated_at ON public.pets;
CREATE TRIGGER trg_pets_updated_at
BEFORE UPDATE ON public.pets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- 5. SERVICES
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.services (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id       UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name              TEXT NOT NULL,
    duration_minutes  INTEGER NOT NULL DEFAULT 30,
    price_small       NUMERIC(10,2) NOT NULL DEFAULT 0,
    price_medium      NUMERIC(10,2) NOT NULL DEFAULT 0,
    price_large       NUMERIC(10,2) NOT NULL DEFAULT 0,
    active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_business_id ON public.services(business_id);
CREATE INDEX IF NOT EXISTS idx_services_active      ON public.services(business_id, active);

DROP TRIGGER IF EXISTS trg_services_updated_at ON public.services;
CREATE TRIGGER trg_services_updated_at
BEFORE UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- 6. EMPLOYEES
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.employees (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id        UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_id            UUID REFERENCES public.users(id) ON DELETE SET NULL,
    name               TEXT NOT NULL,
    role               TEXT,
    commission_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    active             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_business_id ON public.employees(business_id);
CREATE INDEX IF NOT EXISTS idx_employees_user_id     ON public.employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_active      ON public.employees(business_id, active);

DROP TRIGGER IF EXISTS trg_employees_updated_at ON public.employees;
CREATE TRIGGER trg_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- 7. APPOINTMENTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.appointments (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id  UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    customer_id  UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    pet_id       UUID NOT NULL REFERENCES public.pets(id) ON DELETE RESTRICT,
    employee_id  UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    service_id   UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
    start_time   TIMESTAMPTZ NOT NULL,
    end_time     TIMESTAMPTZ NOT NULL,
    status       appointment_status NOT NULL DEFAULT 'scheduled',
    price        NUMERIC(10,2) NOT NULL DEFAULT 0,
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_business_id  ON public.appointments(business_id);
CREATE INDEX IF NOT EXISTS idx_appointments_customer_id  ON public.appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_pet_id       ON public.appointments(pet_id);
CREATE INDEX IF NOT EXISTS idx_appointments_employee_id  ON public.appointments(employee_id);
CREATE INDEX IF NOT EXISTS idx_appointments_service_id   ON public.appointments(service_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time   ON public.appointments(business_id, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status       ON public.appointments(business_id, status);

DROP TRIGGER IF EXISTS trg_appointments_updated_at ON public.appointments;
CREATE TRIGGER trg_appointments_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- 8. MEDICAL RECORDS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.medical_records (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id     UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    pet_id          UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
    appointment_id  UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    anamnesis       TEXT,
    prescription    TEXT,
    observations    TEXT,
    created_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medical_records_business_id    ON public.medical_records(business_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_pet_id         ON public.medical_records(pet_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_appointment_id ON public.medical_records(appointment_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_created_at     ON public.medical_records(business_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_medical_records_updated_at ON public.medical_records;
CREATE TRIGGER trg_medical_records_updated_at
BEFORE UPDATE ON public.medical_records
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- 9. FINANCIAL TRANSACTIONS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.financial_transactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id     UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    appointment_id  UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    type            transaction_type NOT NULL,
    amount          NUMERIC(12,2) NOT NULL,
    payment_method  TEXT,
    description     TEXT,
    date            DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fin_tx_business_id    ON public.financial_transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_fin_tx_appointment_id ON public.financial_transactions(appointment_id);
CREATE INDEX IF NOT EXISTS idx_fin_tx_type           ON public.financial_transactions(business_id, type);
CREATE INDEX IF NOT EXISTS idx_fin_tx_date           ON public.financial_transactions(business_id, date DESC);

DROP TRIGGER IF EXISTS trg_fin_tx_updated_at ON public.financial_transactions;
CREATE TRIGGER trg_fin_tx_updated_at
BEFORE UPDATE ON public.financial_transactions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- 10. PRODUCTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.products (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id     UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    category        TEXT,
    price           NUMERIC(10,2) NOT NULL DEFAULT 0,
    cost            NUMERIC(10,2) NOT NULL DEFAULT 0,
    stock_quantity  INTEGER NOT NULL DEFAULT 0,
    min_stock       INTEGER NOT NULL DEFAULT 0,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_business_id ON public.products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_name        ON public.products(business_id, name);
CREATE INDEX IF NOT EXISTS idx_products_category    ON public.products(business_id, category);
CREATE INDEX IF NOT EXISTS idx_products_active      ON public.products(business_id, active);

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- 11. NOTIFICATIONS LOG
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.notifications_log (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id  UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    customer_id  UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    type         notification_type NOT NULL,
    message      TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending',
    sent_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_business_id ON public.notifications_log(business_id);
CREATE INDEX IF NOT EXISTS idx_notif_customer_id ON public.notifications_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_notif_type        ON public.notifications_log(business_id, type);
CREATE INDEX IF NOT EXISTS idx_notif_status      ON public.notifications_log(business_id, status);
CREATE INDEX IF NOT EXISTS idx_notif_sent_at     ON public.notifications_log(business_id, sent_at DESC);

DROP TRIGGER IF EXISTS trg_notifications_log_updated_at ON public.notifications_log;
CREATE TRIGGER trg_notifications_log_updated_at
BEFORE UPDATE ON public.notifications_log
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
-- Enable RLS on every table
ALTER TABLE public.businesses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pets                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_records        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_log      ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- businesses: user can only see their own business
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS businesses_tenant_isolation ON public.businesses;
CREATE POLICY businesses_tenant_isolation ON public.businesses
    FOR ALL
    TO authenticated
    USING (id = public.current_business_id())
    WITH CHECK (id = public.current_business_id());

-- ---------------------------------------------------------------------
-- users: user can only see users belonging to same business
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS users_tenant_isolation ON public.users;
CREATE POLICY users_tenant_isolation ON public.users
    FOR ALL
    TO authenticated
    USING (business_id = public.current_business_id() OR id = auth.uid())
    WITH CHECK (business_id = public.current_business_id());

-- ---------------------------------------------------------------------
-- Generic tenant-isolation policy macro (applied per table)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS customers_tenant_isolation ON public.customers;
CREATE POLICY customers_tenant_isolation ON public.customers
    FOR ALL TO authenticated
    USING (business_id = public.current_business_id())
    WITH CHECK (business_id = public.current_business_id());

DROP POLICY IF EXISTS pets_tenant_isolation ON public.pets;
CREATE POLICY pets_tenant_isolation ON public.pets
    FOR ALL TO authenticated
    USING (business_id = public.current_business_id())
    WITH CHECK (business_id = public.current_business_id());

DROP POLICY IF EXISTS services_tenant_isolation ON public.services;
CREATE POLICY services_tenant_isolation ON public.services
    FOR ALL TO authenticated
    USING (business_id = public.current_business_id())
    WITH CHECK (business_id = public.current_business_id());

DROP POLICY IF EXISTS employees_tenant_isolation ON public.employees;
CREATE POLICY employees_tenant_isolation ON public.employees
    FOR ALL TO authenticated
    USING (business_id = public.current_business_id())
    WITH CHECK (business_id = public.current_business_id());

DROP POLICY IF EXISTS appointments_tenant_isolation ON public.appointments;
CREATE POLICY appointments_tenant_isolation ON public.appointments
    FOR ALL TO authenticated
    USING (business_id = public.current_business_id())
    WITH CHECK (business_id = public.current_business_id());

DROP POLICY IF EXISTS medical_records_tenant_isolation ON public.medical_records;
CREATE POLICY medical_records_tenant_isolation ON public.medical_records
    FOR ALL TO authenticated
    USING (business_id = public.current_business_id())
    WITH CHECK (business_id = public.current_business_id());

DROP POLICY IF EXISTS financial_transactions_tenant_isolation ON public.financial_transactions;
CREATE POLICY financial_transactions_tenant_isolation ON public.financial_transactions
    FOR ALL TO authenticated
    USING (business_id = public.current_business_id())
    WITH CHECK (business_id = public.current_business_id());

DROP POLICY IF EXISTS products_tenant_isolation ON public.products;
CREATE POLICY products_tenant_isolation ON public.products
    FOR ALL TO authenticated
    USING (business_id = public.current_business_id())
    WITH CHECK (business_id = public.current_business_id());

DROP POLICY IF EXISTS notifications_log_tenant_isolation ON public.notifications_log;
CREATE POLICY notifications_log_tenant_isolation ON public.notifications_log
    FOR ALL TO authenticated
    USING (business_id = public.current_business_id())
    WITH CHECK (business_id = public.current_business_id());

-- =====================================================================
-- END OF SCHEMA
-- =====================================================================
