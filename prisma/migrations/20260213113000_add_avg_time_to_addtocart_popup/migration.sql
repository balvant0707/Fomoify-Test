ALTER TABLE `addtocartpopupconfig`
  ADD COLUMN IF NOT EXISTS `avgTime` VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `avgUnit` VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `customerInfo` VARCHAR(191) NULL;

UPDATE `addtocartpopupconfig`
SET
  `avgTime` = COALESCE(`avgTime`, '3'),
  `avgUnit` = COALESCE(`avgUnit`, 'mins'),
  `customerInfo` = COALESCE(`customerInfo`, 'shopify');
