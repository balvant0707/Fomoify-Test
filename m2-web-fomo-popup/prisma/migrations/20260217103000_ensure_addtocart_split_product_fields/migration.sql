-- Ensure add-to-cart popup keeps data products and visibility products separately.
ALTER TABLE `addtocartpopupconfig`
  ADD COLUMN IF NOT EXISTS `selectedDataProductsJson` LONGTEXT NULL,
  ADD COLUMN IF NOT EXISTS `selectedVisibilityProductsJson` LONGTEXT NULL;

-- Backfill split columns from legacy selection payload.
UPDATE `addtocartpopupconfig`
SET
  `selectedDataProductsJson` = COALESCE(`selectedDataProductsJson`, `selectedProductsJson`),
  `selectedVisibilityProductsJson` = COALESCE(`selectedVisibilityProductsJson`, `selectedProductsJson`);

-- Keep legacy field populated for backward compatibility.
UPDATE `addtocartpopupconfig`
SET `selectedProductsJson` = `selectedDataProductsJson`
WHERE `selectedProductsJson` IS NULL AND `selectedDataProductsJson` IS NOT NULL;
