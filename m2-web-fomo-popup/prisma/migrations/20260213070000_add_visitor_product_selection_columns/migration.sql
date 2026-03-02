-- Add separate product selection buckets for visitor popup:
-- 1) selectedDataProductsJson: product pool used in popup content
-- 2) selectedVisibilityProductsJson: product pages where popup can appear

ALTER TABLE `visitorpopupconfig`
  ADD COLUMN IF NOT EXISTS `selectedDataProductsJson` LONGTEXT NULL,
  ADD COLUMN IF NOT EXISTS `selectedVisibilityProductsJson` LONGTEXT NULL;

-- Backfill from legacy selectedProductsJson.
-- If legacy value is an object with buckets, split from object.
-- Otherwise treat legacy list as both data + visibility list.
UPDATE `visitorpopupconfig`
SET
  `selectedDataProductsJson` = CASE
    WHEN `selectedDataProductsJson` IS NOT NULL THEN `selectedDataProductsJson`
    WHEN JSON_VALID(`selectedProductsJson`) = 1
      AND TRIM(`selectedProductsJson`) LIKE '{%'
      THEN JSON_EXTRACT(`selectedProductsJson`, '$.dataProducts')
    ELSE `selectedProductsJson`
  END,
  `selectedVisibilityProductsJson` = CASE
    WHEN `selectedVisibilityProductsJson` IS NOT NULL THEN `selectedVisibilityProductsJson`
    WHEN JSON_VALID(`selectedProductsJson`) = 1
      AND TRIM(`selectedProductsJson`) LIKE '{%'
      THEN COALESCE(
        JSON_EXTRACT(`selectedProductsJson`, '$.visibilityProducts'),
        JSON_EXTRACT(`selectedProductsJson`, '$.dataProducts')
      )
    ELSE `selectedProductsJson`
  END;

-- Normalize selectedProductsJson to remain backward-compatible with old clients
-- that still read a single product list.
UPDATE `visitorpopupconfig`
SET `selectedProductsJson` = `selectedDataProductsJson`
WHERE `selectedDataProductsJson` IS NOT NULL
  AND (
    `selectedProductsJson` IS NULL
    OR (
      JSON_VALID(`selectedProductsJson`) = 1
      AND TRIM(`selectedProductsJson`) LIKE '{%'
    )
  );
