-- ============================================================================
-- SQL Script to resolve the "Table publicly accessible" security issue.
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Table: products
-- ----------------------------------------------------------------------------
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow public read access to products" ON products;
DROP POLICY IF EXISTS "Allow admin all access to products" ON products;

-- Anyone can view products
CREATE POLICY "Allow public read access to products" ON products
    FOR SELECT USING (true);

-- Admins can manage products
CREATE POLICY "Allow admin all access to products" ON products
    FOR ALL TO authenticated, anon USING (
        (auth.jwt() ->> 'email') IN ('contact.sabara@gmail.com', 'sumansamanta721467@gmail.com')
    ) WITH CHECK (
        (auth.jwt() ->> 'email') IN ('contact.sabara@gmail.com', 'sumansamanta721467@gmail.com')
    );


-- ----------------------------------------------------------------------------
-- 2. Table: orders
-- ----------------------------------------------------------------------------
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to select their own orders" ON orders;
DROP POLICY IF EXISTS "Allow users to insert their own orders" ON orders;
DROP POLICY IF EXISTS "Allow admin all access to orders" ON orders;

-- Users can view their own orders
CREATE POLICY "Allow users to select their own orders" ON orders
    FOR SELECT USING (
        auth.uid() = user_id OR (auth.jwt() ->> 'email') = customer_email
    );

-- Users (both registered and guests) can insert orders
CREATE POLICY "Allow users to insert their own orders" ON orders
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR user_id IS NULL
    );

-- Admins have full access to orders
CREATE POLICY "Allow admin all access to orders" ON orders
    FOR ALL TO authenticated, anon USING (
        (auth.jwt() ->> 'email') IN ('contact.sabara@gmail.com', 'sumansamanta721467@gmail.com')
    ) WITH CHECK (
        (auth.jwt() ->> 'email') IN ('contact.sabara@gmail.com', 'sumansamanta721467@gmail.com')
    );


-- ----------------------------------------------------------------------------
-- 3. Table: order_items
-- ----------------------------------------------------------------------------
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to select their own order items" ON order_items;
DROP POLICY IF EXISTS "Allow anyone to insert order items" ON order_items;
DROP POLICY IF EXISTS "Allow admin all access to order items" ON order_items;

-- Users can view their own order items
CREATE POLICY "Allow users to select their own order items" ON order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
              AND (orders.user_id = auth.uid() OR orders.customer_email = (auth.jwt() ->> 'email'))
        )
    );

-- Anyone can insert order items (needed during checkout)
CREATE POLICY "Allow anyone to insert order items" ON order_items
    FOR INSERT WITH CHECK (true);

-- Admins have full access to order items
CREATE POLICY "Allow admin all access to order items" ON order_items
    FOR ALL TO authenticated, anon USING (
        (auth.jwt() ->> 'email') IN ('contact.sabara@gmail.com', 'sumansamanta721467@gmail.com')
    ) WITH CHECK (
        (auth.jwt() ->> 'email') IN ('contact.sabara@gmail.com', 'sumansamanta721467@gmail.com')
    );


-- ----------------------------------------------------------------------------
-- 4. Table: user_profiles
-- ----------------------------------------------------------------------------
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to select their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Allow admin all access to profiles" ON user_profiles;

-- Users can manage their own profile
CREATE POLICY "Allow users to select their own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Allow users to insert their own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow users to update their own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- Admins have full access to profiles
CREATE POLICY "Allow admin all access to profiles" ON user_profiles
    FOR ALL TO authenticated, anon USING (
        (auth.jwt() ->> 'email') IN ('contact.sabara@gmail.com', 'sumansamanta721467@gmail.com')
    ) WITH CHECK (
        (auth.jwt() ->> 'email') IN ('contact.sabara@gmail.com', 'sumansamanta721467@gmail.com')
    );


-- ----------------------------------------------------------------------------
-- 5. Table: site_settings
-- ----------------------------------------------------------------------------
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to site_settings" ON site_settings;
DROP POLICY IF EXISTS "Allow admin all access to site_settings" ON site_settings;

-- Anyone can view site settings
CREATE POLICY "Allow public read access to site_settings" ON site_settings
    FOR SELECT USING (true);

-- Admins have full access to site settings
CREATE POLICY "Allow admin all access to site_settings" ON site_settings
    FOR ALL TO authenticated, anon USING (
        (auth.jwt() ->> 'email') IN ('contact.sabara@gmail.com', 'sumansamanta721467@gmail.com')
    ) WITH CHECK (
        (auth.jwt() ->> 'email') IN ('contact.sabara@gmail.com', 'sumansamanta721467@gmail.com')
    );
