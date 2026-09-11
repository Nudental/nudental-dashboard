-- ============================================================
-- Front Desk Inventory Table - Safe Recreation Migration
-- This migration safely creates the front_desk_inventory table
-- and all dependencies if they do not already exist.
-- ============================================================

-- 1. ENUM TYPES (idempotent: drop if exists, then create)
DROP TYPE IF EXISTS public.front_desk_office_location CASCADE;
CREATE TYPE public.front_desk_office_location AS ENUM (
  'Nu Dental of Eatontown',
  'Nu Dental of Brick',
  'Nu Dental of Barnegat',
  'Nu Dental of Staten Island'
);

DROP TYPE IF EXISTS public.front_desk_item_status CASCADE;
CREATE TYPE public.front_desk_item_status AS ENUM (
  'In Stock',
  'Low',
  'Critically Low',
  'Out of Stock',
  'Discontinued'
);

DROP TYPE IF EXISTS public.front_desk_priority CASCADE;
CREATE TYPE public.front_desk_priority AS ENUM (
  'Normal',
  'Important',
  'High',
  'Urgent',
  'Critical'
);

DROP TYPE IF EXISTS public.front_desk_order_status CASCADE;
CREATE TYPE public.front_desk_order_status AS ENUM (
  'Not Ordered',
  'Draft',
  'Submitted',
  'Approved',
  'Ordered',
  'Partially Fulfilled',
  'Fulfilled',
  'Rejected'
);

-- 2. TABLE
CREATE TABLE IF NOT EXISTS public.front_desk_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_location public.front_desk_office_location NOT NULL,
  category TEXT NOT NULL,
  item_name TEXT NOT NULL,
  current_qty INTEGER NOT NULL DEFAULT 0,
  min_required INTEGER NOT NULL DEFAULT 1,
  status public.front_desk_item_status NOT NULL DEFAULT 'Out of Stock',
  priority public.front_desk_priority NOT NULL DEFAULT 'Normal',
  last_supplied_date DATE,
  notes TEXT,
  requested_by TEXT,
  approved_by TEXT,
  order_status public.front_desk_order_status NOT NULL DEFAULT 'Not Ordered',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_fdi_office_location ON public.front_desk_inventory(office_location);
CREATE INDEX IF NOT EXISTS idx_fdi_category ON public.front_desk_inventory(category);
CREATE INDEX IF NOT EXISTS idx_fdi_status ON public.front_desk_inventory(status);
CREATE INDEX IF NOT EXISTS idx_fdi_office_category ON public.front_desk_inventory(office_location, category);

-- 4. AUTO-STATUS TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.fdi_auto_update_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.current_qty = 0 THEN
    NEW.status := 'Out of Stock'::public.front_desk_item_status;
  ELSIF NEW.current_qty <= (NEW.min_required / 2) THEN
    NEW.status := 'Critically Low'::public.front_desk_item_status;
  ELSIF NEW.current_qty <= NEW.min_required THEN
    NEW.status := 'Low'::public.front_desk_item_status;
  ELSE
    NEW.status := 'In Stock'::public.front_desk_item_status;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fdi_status_trigger ON public.front_desk_inventory;
CREATE TRIGGER fdi_status_trigger
  BEFORE INSERT OR UPDATE OF current_qty, min_required
  ON public.front_desk_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.fdi_auto_update_status();

-- 5. HELPER FUNCTIONS FOR RLS
CREATE OR REPLACE FUNCTION public.fdi_get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.fdi_get_user_office()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT o.name
  FROM public.user_profiles up
  JOIN public.offices o ON o.id = up.office_id
  WHERE up.id = auth.uid()
  LIMIT 1;
$$;

-- 6. ENABLE RLS
ALTER TABLE public.front_desk_inventory ENABLE ROW LEVEL SECURITY;

-- 7. RLS POLICIES
DROP POLICY IF EXISTS "fdi_super_admin_rcm_full_access" ON public.front_desk_inventory;
CREATE POLICY "fdi_super_admin_rcm_full_access"
  ON public.front_desk_inventory
  FOR ALL
  TO authenticated
  USING (public.fdi_get_user_role() IN ('super_admin', 'regional_clinical_manager'))
  WITH CHECK (public.fdi_get_user_role() IN ('super_admin', 'regional_clinical_manager'));

DROP POLICY IF EXISTS "fdi_admin_om_own_office" ON public.front_desk_inventory;
CREATE POLICY "fdi_admin_om_own_office"
  ON public.front_desk_inventory
  FOR ALL
  TO authenticated
  USING (
    public.fdi_get_user_role() IN ('admin', 'office_manager')
    AND office_location::TEXT = public.fdi_get_user_office()
  )
  WITH CHECK (
    public.fdi_get_user_role() IN ('admin', 'office_manager')
    AND office_location::TEXT = public.fdi_get_user_office()
  );

DROP POLICY IF EXISTS "fdi_staff_read_update_own_office" ON public.front_desk_inventory;
CREATE POLICY "fdi_staff_read_update_own_office"
  ON public.front_desk_inventory
  FOR SELECT
  TO authenticated
  USING (
    public.fdi_get_user_role() = 'staff'
    AND office_location::TEXT = public.fdi_get_user_office()
  );

DROP POLICY IF EXISTS "fdi_staff_update_qty_own_office" ON public.front_desk_inventory;
CREATE POLICY "fdi_staff_update_qty_own_office"
  ON public.front_desk_inventory
  FOR UPDATE
  TO authenticated
  USING (
    public.fdi_get_user_role() = 'staff'
    AND office_location::TEXT = public.fdi_get_user_office()
  )
  WITH CHECK (
    public.fdi_get_user_role() = 'staff'
    AND office_location::TEXT = public.fdi_get_user_office()
  );

-- 8. SEED DATA (only if table is empty)
DO $$
DECLARE
  offices TEXT[] := ARRAY[
    'Nu Dental of Eatontown',
    'Nu Dental of Brick',
    'Nu Dental of Barnegat',
    'Nu Dental of Staten Island'
  ];
  office_val TEXT;
  items_general TEXT[] := ARRAY[
    'Copy paper','Printer paper','Colored paper','Cardstock','Notepads',
    'Sticky notes','Legal pads','Pens','Pencils','Highlighters',
    'Permanent markers','Dry erase markers','Correction tape','Index cards','Labels',
    'Label maker tape','File folders','Hanging folders','Binder dividers','Sheet protectors',
    'Clipboards','Staplers','Staples','Paper clips','Binder clips',
    'Rubber bands','Scissors','Tape','Packing tape','Glue sticks',
    'Hole punch','Envelopes','Large mailing envelopes','Shipping boxes'
  ];
  items_printing TEXT[] := ARRAY[
    'Printer ink','Toner cartridges','Receipt paper','Appointment cards','Business cards',
    'Referral pads','Letterhead','Window envelopes','Mailing labels','Return address labels',
    'New patient packets','Medical history forms','Dental history forms','Update forms','HIPAA forms',
    'Consent forms','Financial agreement forms','Insurance forms','Treatment plan print paper','Deposit slips',
    'Check stock','Receipt books'
  ];
  items_checkin TEXT[] := ARRAY[
    'Patient pens','Clipboards','Tablet pens/stylus','Tablet chargers','Tablet cleaning wipes',
    'Business card holders','Brochure holders','Sign-in sheets','Payment authorization forms','Appointment reminder cards'
  ];
  items_insurance TEXT[] := ARRAY[
    'EOB filing folders','Claim tracking sheets','Pre-authorization folders','Insurance verification sheets',
    'Deposit log sheets','Payment collection log sheets','Credit card terminal paper',
    'Merchant settlement paper','Bank deposit bags','End-of-day reconciliation sheets'
  ];
  items_technology TEXT[] := ARRAY[
    'Keyboard','Mouse','Mouse pad','Monitor wipes','Screen cleaner',
    'Surge protectors','Extension cords','USB drives','External backup drive','Device chargers',
    'UPS battery backup','Ethernet cables','Power strips','Webcam','Telephone headsets',
    'Phone cords','AA batteries','AAA batteries'
  ];
  items_reception TEXT[] := ARRAY[
    'Tissues','Hand sanitizer','Disinfecting wipes','Hand lotion','Bottled water',
    'Coffee supplies','Tea supplies','Cups','Cup lids','Stir sticks',
    'Sugar/sweeteners','Creamer','Napkins','Magazines','Children''s books',
    'Coloring books','Crayons','Welcome signage','Wi-Fi cards','Referral cards',
    'Service brochures','Financing brochures','Review request cards'
  ];
  items_cleaning TEXT[] := ARRAY[
    'Surface disinfectant spray','Paper towels','Trash bags','Gloves','Glass cleaner',
    'Keyboard wipes','Air freshener','Mini broom/dustpan','Shredder bags','Sanitizer refill'
  ];
  items_mail TEXT[] := ARRAY[
    'Stamps','Certified mail stickers','Shipping labels','Bubble mailers',
    'Padded envelopes','Packing peanuts','Bubble wrap','Return labels'
  ];
  items_security TEXT[] := ARRAY[
    'Visitor sign-in log','Badge holders','Access cards','Lanyards','Key tags',
    'Lock box','Cash drawer slips','Deposit envelopes','Tamper-evident bags','Coin wrappers',
    'Petty cash envelopes','Calculator','Endorsement stamp'
  ];
  items_emergency TEXT[] := ARRAY[
    'Flashlights','Extra batteries','Emergency contact list','Office phone list','Staff contact sheet',
    'Spare chargers','Backup keyboard','Backup mouse','Backup toner','Backup ink',
    'First aid kit for staff area'
  ];
  item_val TEXT;
  row_count INTEGER;
BEGIN
  -- Only seed if table is empty
  SELECT COUNT(*) INTO row_count FROM public.front_desk_inventory;
  IF row_count > 0 THEN
    RAISE NOTICE 'front_desk_inventory already has data, skipping seed.';
    RETURN;
  END IF;

  FOREACH office_val IN ARRAY offices LOOP
    FOREACH item_val IN ARRAY items_general LOOP
      INSERT INTO public.front_desk_inventory
        (office_location, category, item_name, current_qty, min_required, status, priority, order_status)
      VALUES
        (office_val::public.front_desk_office_location, 'General Office', item_val, 0, 5,
         'Out of Stock'::public.front_desk_item_status, 'Normal'::public.front_desk_priority,
         'Not Ordered'::public.front_desk_order_status)
      ON CONFLICT DO NOTHING;
    END LOOP;
    FOREACH item_val IN ARRAY items_printing LOOP
      INSERT INTO public.front_desk_inventory
        (office_location, category, item_name, current_qty, min_required, status, priority, order_status)
      VALUES
        (office_val::public.front_desk_office_location, 'Printing & Forms', item_val, 0, 5,
         'Out of Stock'::public.front_desk_item_status, 'Normal'::public.front_desk_priority,
         'Not Ordered'::public.front_desk_order_status)
      ON CONFLICT DO NOTHING;
    END LOOP;
    FOREACH item_val IN ARRAY items_checkin LOOP
      INSERT INTO public.front_desk_inventory
        (office_location, category, item_name, current_qty, min_required, status, priority, order_status)
      VALUES
        (office_val::public.front_desk_office_location, 'Patient Check-In/Out', item_val, 0, 5,
         'Out of Stock'::public.front_desk_item_status, 'Normal'::public.front_desk_priority,
         'Not Ordered'::public.front_desk_order_status)
      ON CONFLICT DO NOTHING;
    END LOOP;
    FOREACH item_val IN ARRAY items_insurance LOOP
      INSERT INTO public.front_desk_inventory
        (office_location, category, item_name, current_qty, min_required, status, priority, order_status)
      VALUES
        (office_val::public.front_desk_office_location, 'Insurance/Billing', item_val, 0, 5,
         'Out of Stock'::public.front_desk_item_status, 'Normal'::public.front_desk_priority,
         'Not Ordered'::public.front_desk_order_status)
      ON CONFLICT DO NOTHING;
    END LOOP;
    FOREACH item_val IN ARRAY items_technology LOOP
      INSERT INTO public.front_desk_inventory
        (office_location, category, item_name, current_qty, min_required, status, priority, order_status)
      VALUES
        (office_val::public.front_desk_office_location, 'Technology/Equipment', item_val, 0, 5,
         'Out of Stock'::public.front_desk_item_status, 'Normal'::public.front_desk_priority,
         'Not Ordered'::public.front_desk_order_status)
      ON CONFLICT DO NOTHING;
    END LOOP;
    FOREACH item_val IN ARRAY items_reception LOOP
      INSERT INTO public.front_desk_inventory
        (office_location, category, item_name, current_qty, min_required, status, priority, order_status)
      VALUES
        (office_val::public.front_desk_office_location, 'Reception/Waiting', item_val, 0, 5,
         'Out of Stock'::public.front_desk_item_status, 'Normal'::public.front_desk_priority,
         'Not Ordered'::public.front_desk_order_status)
      ON CONFLICT DO NOTHING;
    END LOOP;
    FOREACH item_val IN ARRAY items_cleaning LOOP
      INSERT INTO public.front_desk_inventory
        (office_location, category, item_name, current_qty, min_required, status, priority, order_status)
      VALUES
        (office_val::public.front_desk_office_location, 'Cleaning/Maintenance', item_val, 0, 5,
         'Out of Stock'::public.front_desk_item_status, 'Normal'::public.front_desk_priority,
         'Not Ordered'::public.front_desk_order_status)
      ON CONFLICT DO NOTHING;
    END LOOP;
    FOREACH item_val IN ARRAY items_mail LOOP
      INSERT INTO public.front_desk_inventory
        (office_location, category, item_name, current_qty, min_required, status, priority, order_status)
      VALUES
        (office_val::public.front_desk_office_location, 'Mail/Shipping', item_val, 0, 5,
         'Out of Stock'::public.front_desk_item_status, 'Normal'::public.front_desk_priority,
         'Not Ordered'::public.front_desk_order_status)
      ON CONFLICT DO NOTHING;
    END LOOP;
    FOREACH item_val IN ARRAY items_security LOOP
      INSERT INTO public.front_desk_inventory
        (office_location, category, item_name, current_qty, min_required, status, priority, order_status)
      VALUES
        (office_val::public.front_desk_office_location, 'Security/Financial', item_val, 0, 5,
         'Out of Stock'::public.front_desk_item_status, 'Normal'::public.front_desk_priority,
         'Not Ordered'::public.front_desk_order_status)
      ON CONFLICT DO NOTHING;
    END LOOP;
    FOREACH item_val IN ARRAY items_emergency LOOP
      INSERT INTO public.front_desk_inventory
        (office_location, category, item_name, current_qty, min_required, status, priority, order_status)
      VALUES
        (office_val::public.front_desk_office_location, 'Emergency/Backup', item_val, 0, 5,
         'Out of Stock'::public.front_desk_item_status, 'Normal'::public.front_desk_priority,
         'Not Ordered'::public.front_desk_order_status)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed data insertion error: %', SQLERRM;
END $$;
