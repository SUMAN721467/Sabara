-- ============================================================================
-- SQL Script to create a dedicated 'shipping_addresses' table in Supabase
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- ============================================================================

-- 1. Create the shipping_addresses table
CREATE TABLE IF NOT EXISTS public.shipping_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    street TEXT NOT NULL,
    landmark TEXT,
    district TEXT NOT NULL,
    city TEXT,
    state TEXT NOT NULL,
    zip_code TEXT NOT NULL,
    label TEXT DEFAULT 'HOME',
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create index for fast lookups by user_id
CREATE INDEX IF NOT EXISTS idx_shipping_addresses_user_id ON public.shipping_addresses(user_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.shipping_addresses ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if already present
DROP POLICY IF EXISTS "Users can view their own shipping addresses" ON public.shipping_addresses;
DROP POLICY IF EXISTS "Users can insert their own shipping addresses" ON public.shipping_addresses;
DROP POLICY IF EXISTS "Users can update their own shipping addresses" ON public.shipping_addresses;
DROP POLICY IF EXISTS "Users can delete their own shipping addresses" ON public.shipping_addresses;
DROP POLICY IF EXISTS "Admins have full access to shipping addresses" ON public.shipping_addresses;

-- 5. Policies for authenticated users to manage their own addresses
CREATE POLICY "Users can view their own shipping addresses" ON public.shipping_addresses
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own shipping addresses" ON public.shipping_addresses
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shipping addresses" ON public.shipping_addresses
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shipping addresses" ON public.shipping_addresses
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- 6. Admins have full access
CREATE POLICY "Admins have full access to shipping addresses" ON public.shipping_addresses
    FOR ALL TO authenticated, anon
    USING (
        (auth.jwt() ->> 'email') IN ('contact.sabara@gmail.com', 'sumansamanta721467@gmail.com')
    )
    WITH CHECK (
        (auth.jwt() ->> 'email') IN ('contact.sabara@gmail.com', 'sumansamanta721467@gmail.com')
    );
