-- Align shop install tracking fields with current schema.
ALTER TABLE `shop`
  MODIFY COLUMN `installed` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS `uninstalledAt` DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS `onboardedAt` DATETIME(3) NULL;
