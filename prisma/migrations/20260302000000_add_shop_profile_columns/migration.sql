-- Add missing shop profile columns.
-- The shop table was created in 20250901052335_add_shop_table with only basic columns.
-- upsertInstalledShop requires `status`, and syncShopDetails requires the owner/profile
-- fields. Without these columns every prisma.shop.upsert() throws and is silently caught,
-- so no shop row is ever persisted.

-- On case-sensitive MySQL (Linux production) the first migration may have created `Shop`
-- (capital S) while Prisma targets `shop` (lowercase). Rename if needed.
SET @has_shop_lower := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'shop'
);

SET @has_shop_upper := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'Shop'
);

SET @rename_shop_sql := IF(
  @has_shop_lower = 0 AND @has_shop_upper = 1,
  'RENAME TABLE `Shop` TO `shop`',
  'SELECT 1'
);

PREPARE stmt FROM @rename_shop_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add all missing profile columns (ADD COLUMN IF NOT EXISTS is safe to re-run).
ALTER TABLE `shop`
  ADD COLUMN IF NOT EXISTS `status`              VARCHAR(32)   NULL DEFAULT 'installed',
  ADD COLUMN IF NOT EXISTS `ownerName`           VARCHAR(255)  NULL,
  ADD COLUMN IF NOT EXISTS `email`               VARCHAR(320)  NULL,
  ADD COLUMN IF NOT EXISTS `contactEmail`        VARCHAR(320)  NULL,
  ADD COLUMN IF NOT EXISTS `name`                VARCHAR(255)  NULL,
  ADD COLUMN IF NOT EXISTS `country`             VARCHAR(100)  NULL,
  ADD COLUMN IF NOT EXISTS `city`                VARCHAR(100)  NULL,
  ADD COLUMN IF NOT EXISTS `currency`            VARCHAR(10)   NULL,
  ADD COLUMN IF NOT EXISTS `phone`               VARCHAR(50)   NULL,
  ADD COLUMN IF NOT EXISTS `primaryDomain`       VARCHAR(255)  NULL,
  ADD COLUMN IF NOT EXISTS `plan`                VARCHAR(100)  NULL,
  ADD COLUMN IF NOT EXISTS `announcementEmailSentAt` DATETIME(3) NULL;

-- Backfill status for existing rows.
UPDATE `shop` SET `status` = 'installed'   WHERE `installed` = 1 AND `status` IS NULL;
UPDATE `shop` SET `status` = 'uninstalled' WHERE `installed` = 0 AND `status` IS NULL;
