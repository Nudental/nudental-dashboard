-- Service Categories Migration
-- Creates service_categories table and seeds initial data including Implants and Botox

-- 1. Create service_categories table
CREATE TABLE IF NOT EXISTS public.service_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_service_categories_is_active ON public.service_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_service_categories_name ON public.service_categories(name);

-- 3. Trigger for updated_at
DROP TRIGGER IF EXISTS set_service_categories_updated_at ON public.service_categories;
CREATE TRIGGER set_service_categories_updated_at
    BEFORE UPDATE ON public.service_categories
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Enable RLS
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "authenticated_read_service_categories" ON public.service_categories;
CREATE POLICY "authenticated_read_service_categories"
ON public.service_categories
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "super_admin_manage_service_categories" ON public.service_categories;
CREATE POLICY "super_admin_manage_service_categories"
ON public.service_categories
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- 6. Seed initial service categories
INSERT INTO public.service_categories (name, description, is_active) VALUES
    ('General Dentistry', 'Routine dental care including cleanings, fillings, and exams', true),
    ('Orthodontics', 'Braces, aligners, and teeth straightening treatments', true),
    ('Periodontics', 'Gum disease treatment and periodontal care', true),
    ('Endodontics', 'Root canal therapy and pulp treatments', true),
    ('Oral Surgery', 'Tooth extractions and surgical dental procedures', true),
    ('Cosmetic Dentistry', 'Teeth whitening, veneers, and aesthetic treatments', true),
    ('Prosthodontics', 'Crowns, bridges, dentures, and restorations', true),
    ('Pediatric Dentistry', 'Dental care for children and adolescents', true),
    ('Implants', 'Dental implant placement and restoration', true),
    ('Botox', 'Botox and facial aesthetic treatments', true)
ON CONFLICT DO NOTHING;
