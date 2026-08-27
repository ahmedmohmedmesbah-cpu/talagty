-- Keep every product offer internally valid, including offers edited from the admin dashboard.
UPDATE products
SET sale_type = 'none', sale_value = 0, sale_start = NULL, sale_end = NULL
WHERE sale_type NOT IN ('none', 'percentage', 'fixed')
   OR (sale_type = 'percentage' AND (sale_value <= 0 OR sale_value > 100))
   OR (sale_type = 'fixed' AND (sale_value <= 0 OR sale_value >= unit_price));

UPDATE products SET sale_value = 0, sale_start = NULL, sale_end = NULL WHERE sale_type = 'none';
UPDATE products SET sale_end = NULL WHERE sale_start IS NOT NULL AND sale_end IS NOT NULL AND sale_end <= sale_start;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_products_sale_value_valid') THEN
        ALTER TABLE products ADD CONSTRAINT chk_products_sale_value_valid CHECK (
            (sale_type = 'none' AND sale_value = 0)
            OR (sale_type = 'percentage' AND sale_value > 0 AND sale_value <= 100)
            OR (sale_type = 'fixed' AND sale_value > 0 AND sale_value < unit_price)
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_products_sale_period_valid') THEN
        ALTER TABLE products ADD CONSTRAINT chk_products_sale_period_valid CHECK (
            sale_start IS NULL OR sale_end IS NULL OR sale_end > sale_start
        );
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ix_products_active_sales
ON products(sale_start, sale_end)
WHERE is_active = TRUE AND sale_type <> 'none';
