-- Add new fields to visitorannouncementconfig
ALTER TABLE `visitorannouncementconfig`
  ADD COLUMN IF NOT EXISTS `animationStyle` VARCHAR(32) NULL,
  ADD COLUMN IF NOT EXISTS `animationSpeed` VARCHAR(16) NULL,
  ADD COLUMN IF NOT EXISTS `countInterval`  INT NULL,
  ADD COLUMN IF NOT EXISTS `prefixText`     VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS `suffixText`     VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS `hideOnMobile`   TINYINT(1) NULL;

-- Add new fields to stockannouncementconfig
ALTER TABLE `stockannouncementconfig`
  ADD COLUMN IF NOT EXISTS `lowStockThreshold` INT NULL,
  ADD COLUMN IF NOT EXISTS `dotAnimationStyle` VARCHAR(32) NULL,
  ADD COLUMN IF NOT EXISTS `dotIcon`           VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS `highlightBg`       VARCHAR(32) NULL,
  ADD COLUMN IF NOT EXISTS `hideOnMobile`      TINYINT(1) NULL;
