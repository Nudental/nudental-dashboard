-- Morning Huddle Module Migration
-- Tables: huddles, huddle_provider_blocks, huddle_checklist_items, huddle_audit_log

-- 1. Create huddles table
CREATE TABLE IF NOT EXISTS public.huddles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  huddle_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  collections_goal NUMERIC DEFAULT 0,
  collections_actual NUMERIC DEFAULT 0,
  new_pt_goal INTEGER DEFAULT 0,
  new_pt_actual INTEGER DEFAULT 0,
  new_pt_today INTEGER DEFAULT 0,
  prev_day_wrong TEXT DEFAULT '',
  prev_day_right TEXT DEFAULT '',
  notes_addendum TEXT DEFAULT '',
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  submitted_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_huddles_office_date ON public.huddles(office_id, huddle_date);
CREATE INDEX IF NOT EXISTS idx_huddles_office_id ON public.huddles(office_id);
CREATE INDEX IF NOT EXISTS idx_huddles_huddle_date ON public.huddles(huddle_date);

-- 2. Create huddle_provider_blocks table
CREATE TABLE IF NOT EXISTS public.huddle_provider_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_id UUID NOT NULL REFERENCES public.huddles(id) ON DELETE CASCADE,
  block_order INTEGER NOT NULL CHECK (block_order IN (1, 2, 3)),
  block_type TEXT NOT NULL DEFAULT 'doctor',
  provider_name TEXT DEFAULT '',
  monthly_goal NUMERIC DEFAULT 0,
  monthly_actual NUMERIC DEFAULT 0,
  daily_goal NUMERIC DEFAULT 0,
  scheduled_today NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_huddle_provider_blocks_huddle_id ON public.huddle_provider_blocks(huddle_id);

-- 3. Create huddle_checklist_items table
CREATE TABLE IF NOT EXISTS public.huddle_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_id UUID NOT NULL REFERENCES public.huddles(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  item_number INTEGER NOT NULL,
  item_text TEXT NOT NULL DEFAULT '',
  completed BOOLEAN DEFAULT false,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_huddle_checklist_huddle_id ON public.huddle_checklist_items(huddle_id);

-- 4. Create huddle_audit_log table
CREATE TABLE IF NOT EXISTS public.huddle_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_id UUID NOT NULL REFERENCES public.huddles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  changed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  reason TEXT DEFAULT '',
  diff_summary TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_huddle_audit_log_huddle_id ON public.huddle_audit_log(huddle_id);

-- 5. Helper function for office-scoped access
CREATE OR REPLACE FUNCTION public.user_can_access_huddle_office(office_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
    AND (
      up.role::TEXT IN ('super_admin', 'admin', 'office_manager')
      OR up.office_id = office_uuid
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.user_is_admin_or_above()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
    AND up.role::TEXT IN ('super_admin', 'admin', 'office_manager')
  )
$$;

-- 6. Enable RLS
ALTER TABLE public.huddles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huddle_provider_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huddle_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huddle_audit_log ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for huddles
DROP POLICY IF EXISTS "huddles_select_office_scoped" ON public.huddles;
CREATE POLICY "huddles_select_office_scoped"
ON public.huddles FOR SELECT TO authenticated
USING (public.user_can_access_huddle_office(office_id));

DROP POLICY IF EXISTS "huddles_insert_office_scoped" ON public.huddles;
CREATE POLICY "huddles_insert_office_scoped"
ON public.huddles FOR INSERT TO authenticated
WITH CHECK (public.user_can_access_huddle_office(office_id));

DROP POLICY IF EXISTS "huddles_update_office_scoped" ON public.huddles;
CREATE POLICY "huddles_update_office_scoped"
ON public.huddles FOR UPDATE TO authenticated
USING (public.user_can_access_huddle_office(office_id))
WITH CHECK (public.user_can_access_huddle_office(office_id));

DROP POLICY IF EXISTS "huddles_delete_admin" ON public.huddles;
CREATE POLICY "huddles_delete_admin"
ON public.huddles FOR DELETE TO authenticated
USING (public.user_is_admin_or_above());

-- 8. RLS Policies for huddle_provider_blocks
DROP POLICY IF EXISTS "huddle_provider_blocks_select" ON public.huddle_provider_blocks;
CREATE POLICY "huddle_provider_blocks_select"
ON public.huddle_provider_blocks FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.huddles h
  WHERE h.id = huddle_id AND public.user_can_access_huddle_office(h.office_id)
));

DROP POLICY IF EXISTS "huddle_provider_blocks_insert" ON public.huddle_provider_blocks;
CREATE POLICY "huddle_provider_blocks_insert"
ON public.huddle_provider_blocks FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.huddles h
  WHERE h.id = huddle_id AND public.user_can_access_huddle_office(h.office_id)
));

DROP POLICY IF EXISTS "huddle_provider_blocks_update" ON public.huddle_provider_blocks;
CREATE POLICY "huddle_provider_blocks_update"
ON public.huddle_provider_blocks FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.huddles h
  WHERE h.id = huddle_id AND public.user_can_access_huddle_office(h.office_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.huddles h
  WHERE h.id = huddle_id AND public.user_can_access_huddle_office(h.office_id)
));

DROP POLICY IF EXISTS "huddle_provider_blocks_delete" ON public.huddle_provider_blocks;
CREATE POLICY "huddle_provider_blocks_delete"
ON public.huddle_provider_blocks FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.huddles h
  WHERE h.id = huddle_id AND public.user_can_access_huddle_office(h.office_id)
));

-- 9. RLS Policies for huddle_checklist_items
DROP POLICY IF EXISTS "huddle_checklist_items_select" ON public.huddle_checklist_items;
CREATE POLICY "huddle_checklist_items_select"
ON public.huddle_checklist_items FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.huddles h
  WHERE h.id = huddle_id AND public.user_can_access_huddle_office(h.office_id)
));

DROP POLICY IF EXISTS "huddle_checklist_items_insert" ON public.huddle_checklist_items;
CREATE POLICY "huddle_checklist_items_insert"
ON public.huddle_checklist_items FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.huddles h
  WHERE h.id = huddle_id AND public.user_can_access_huddle_office(h.office_id)
));

DROP POLICY IF EXISTS "huddle_checklist_items_update" ON public.huddle_checklist_items;
CREATE POLICY "huddle_checklist_items_update"
ON public.huddle_checklist_items FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.huddles h
  WHERE h.id = huddle_id AND public.user_can_access_huddle_office(h.office_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.huddles h
  WHERE h.id = huddle_id AND public.user_can_access_huddle_office(h.office_id)
));

DROP POLICY IF EXISTS "huddle_checklist_items_delete" ON public.huddle_checklist_items;
CREATE POLICY "huddle_checklist_items_delete"
ON public.huddle_checklist_items FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.huddles h
  WHERE h.id = huddle_id AND public.user_can_access_huddle_office(h.office_id)
));

-- 10. RLS Policies for huddle_audit_log
DROP POLICY IF EXISTS "huddle_audit_log_select" ON public.huddle_audit_log;
CREATE POLICY "huddle_audit_log_select"
ON public.huddle_audit_log FOR SELECT TO authenticated
USING (public.user_is_admin_or_above());

DROP POLICY IF EXISTS "huddle_audit_log_insert" ON public.huddle_audit_log;
CREATE POLICY "huddle_audit_log_insert"
ON public.huddle_audit_log FOR INSERT TO authenticated
WITH CHECK (changed_by = auth.uid());
