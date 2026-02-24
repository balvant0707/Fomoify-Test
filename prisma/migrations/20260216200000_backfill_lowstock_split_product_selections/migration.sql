-- Ensure low stock popup supports separate product buckets:
-- 1) selectedDataProductsJson: products used to build low-stock popup content
-- 2) selectedVisibilityProductsJson: product pages where popup is allowed

ALTER TABLE `lowstockpopupconfig`
  ADD COLUMN IF NOT EXISTS `selectedDataProductsJson` LONGTEXT NULL,
  ADD COLUMN IF NOT EXISTS `selectedVisibilityProductsJson` LONGTEXT NULL;

-- Backfill split fields from legacy selectedProductsJson when needed.
UPDATE `lowstockpopupconfig`
SET
  `selectedDataProductsJson` = COALESCE(
    NULLIF(`selectedDataProductsJson`, ''),
    `selectedProductsJson`
  ),
  `selectedVisibilityProductsJson` = COALESCE(
    NULLIF(`selectedVisibilityProductsJson`, ''),
    `selectedProductsJson`
  );

-- Keep legacy field backward-compatible for older runtimes.
UPDATE `lowstockpopupconfig`
SET `selectedProductsJson` = `selectedDataProductsJson`
WHERE (`selectedProductsJson` IS NULL OR `selectedProductsJson` = '')
  AND `selectedDataProductsJson` IS NOT NULL
  AND `selectedDataProductsJson` <> '';
