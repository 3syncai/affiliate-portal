-- Add category_id, collection_id, and product_type_id to product_commissions table
-- This allows commission to be set at product, category, collection, or product type level

ALTER TABLE product_commissions 
DROP CONSTRAINT IF EXISTS product_commissions_product_id_key;

ALTER TABLE product_commissions
ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE product_commissions
ADD COLUMN IF NOT EXISTS category_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS collection_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS product_type_id VARCHAR(255);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_product_commissions_lookup 
ON product_commissions(product_id, category_id, collection_id, product_type_id);

-- Add constraint to ensure at least one ID is set
ALTER TABLE product_commissions
ADD CONSTRAINT chk_at_least_one_id CHECK (
    product_id IS NOT NULL OR 
    category_id IS NOT NULL OR 
    collection_id IS NOT NULL OR 
    product_type_id IS NOT NULL
);

COMMENT ON TABLE product_commissions IS 'Commission settings for products - supports hierarchy: product > category > collection > product_type';
COMMENT ON COLUMN product_commissions.product_id IS 'Specific product ID (highest priority)';
COMMENT ON COLUMN product_commissions.category_id IS 'Product category ID (medium-high priority)';
COMMENT ON COLUMN product_commissions.collection_id IS 'Product collection ID (medium priority)';
COMMENT ON COLUMN product_commissions.product_type_id IS 'Product type ID (lowest priority)';
