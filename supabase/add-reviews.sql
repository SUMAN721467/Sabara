-- ============================================================================
-- SQL Script to create product_reviews table and set up RLS policies.
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  user_avatar TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  images TEXT[] DEFAULT '{}',
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid duplicates
DROP POLICY IF EXISTS "Allow public read access to product_reviews" ON product_reviews;
DROP POLICY IF EXISTS "Allow users to insert their own reviews" ON product_reviews;
DROP POLICY IF EXISTS "Allow users to update their own reviews" ON product_reviews;
DROP POLICY IF EXISTS "Allow users to delete their own reviews" ON product_reviews;
DROP POLICY IF EXISTS "Allow admin all access to product_reviews" ON product_reviews;

-- 1. Anyone can view reviews
CREATE POLICY "Allow public read access to product_reviews" ON product_reviews
    FOR SELECT USING (true);

-- 2. Authenticated users can write a review
CREATE POLICY "Allow users to insert their own reviews" ON product_reviews
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
    );

-- 3. Users can update their own reviews
CREATE POLICY "Allow users to update their own reviews" ON product_reviews
    FOR UPDATE USING (
        auth.uid() = user_id
    );

-- 4. Users can delete their own reviews
CREATE POLICY "Allow users to delete their own reviews" ON product_reviews
    FOR DELETE USING (
        auth.uid() = user_id
    );

-- 5. Admins have full access
CREATE POLICY "Allow admin all access to product_reviews" ON product_reviews
    FOR ALL TO authenticated, anon USING (
        (auth.jwt() ->> 'email') IN ('contact.sabara@gmail.com', 'sumansamanta721467@gmail.com')
    ) WITH CHECK (
        (auth.jwt() ->> 'email') IN ('contact.sabara@gmail.com', 'sumansamanta721467@gmail.com')
    );

-- Create index for faster queries on product_id
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_order_id ON product_reviews(order_id);
