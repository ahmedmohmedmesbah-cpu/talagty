INSERT INTO products (sku, name_ar, unit_price) VALUES
('mc1', 'حليب كامل الدسم', 18.00),
('mc2', 'قشدة طازجة', 22.00),
('ch1', 'جبن شيدر', 40.00),
('ch2', 'جبن موتزاريلا', 35.00),
('ln1', 'لانشون بيتزا', 50.00),
('ln2', 'لانشون لحم مدخن', 45.00),
('ln3', 'لانشون كوردن بلو', 48.00),
('ln4', 'لانشون فراخ مدخن', 52.00),
('ln5', 'لانشون سجق', 47.00),
('ln6', 'لانشون بالفلفل الاسود', 46.00),
('ln7', 'لانشون ساده', 44.00),
('ln8', 'لانشون ديك رومى', 49.00)
ON CONFLICT (sku) DO UPDATE SET name_ar = EXCLUDED.name_ar, unit_price = EXCLUDED.unit_price, is_active = TRUE;
