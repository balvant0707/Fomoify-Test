ALTER TABLE `stockannouncementconfig`
  ADD COLUMN IF NOT EXISTS `lowStockText` LONGTEXT NULL;
