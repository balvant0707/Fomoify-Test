-- Add separate product selection buckets for lowstock/addtocart/review popups:
-- 1) selectedDataProductsJson: product pool used in popup content
-- 2) selectedVisibilityProductsJson: product pages where popup can appear

ALTER TABLE `lowstockpopupconfig`
  ADD COLUMN IF NOT EXISTS `selectedDataProductsJson` LONGTEXT NULL,
  ADD COLUMN IF NOT EXISTS `selectedVisibilityProductsJson` LONGTEXT NULL;

ALTER TABLE `addtocartpopupconfig`
  ADD COLUMN IF NOT EXISTS `selectedDataProductsJson` LONGTEXT NULL,
  ADD COLUMN IF NOT EXISTS `selectedVisibilityProductsJson` LONGTEXT NULL;

ALTER TABLE `reviewpopupconfig`
  ADD COLUMN IF NOT EXISTS `selectedDataProductsJson` LONGTEXT NULL,
  ADD COLUMN IF NOT EXISTS `selectedVisibilityProductsJson` LONGTEXT NULL;

-- Backfill new columns from legacy selectedProductsJson.
UPDATE `lowstockpopupconfig`
SET
  `selectedDataProductsJson` = COALESCE(`selectedDataProductsJson`, `selectedProductsJson`),
  `selectedVisibilityProductsJson` = COALESCE(`selectedVisibilityProductsJson`, `selectedProductsJson`);

UPDATE `addtocartpopupconfig`
SET
  `selectedDataProductsJson` = COALESCE(`selectedDataProductsJson`, `selectedProductsJson`),
  `selectedVisibilityProductsJson` = COALESCE(`selectedVisibilityProductsJson`, `selectedProductsJson`);

UPDATE `reviewpopupconfig`
SET
  `selectedDataProductsJson` = COALESCE(`selectedDataProductsJson`, `selectedProductsJson`),
  `selectedVisibilityProductsJson` = COALESCE(`selectedVisibilityProductsJson`, `selectedProductsJson`);

-- Keep legacy field non-destructive and backward-compatible.
UPDATE `lowstockpopupconfig`
SET `selectedProductsJson` = `selectedDataProductsJson`
WHERE `selectedProductsJson` IS NULL AND `selectedDataProductsJson` IS NOT NULL;

UPDATE `addtocartpopupconfig`
SET `selectedProductsJson` = `selectedDataProductsJson`
WHERE `selectedProductsJson` IS NULL AND `selectedDataProductsJson` IS NOT NULL;

UPDATE `reviewpopupconfig`
SET `selectedProductsJson` = `selectedDataProductsJson`
WHERE `selectedProductsJson` IS NULL AND `selectedDataProductsJson` IS NOT NULL;
