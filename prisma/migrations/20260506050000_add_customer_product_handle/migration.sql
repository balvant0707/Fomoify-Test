CREATE TABLE IF NOT EXISTS `customerproducthandle` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `shop` VARCHAR(255) NOT NULL,
  `orderId` VARCHAR(128) NOT NULL,
  `productHandle` VARCHAR(255) NOT NULL,
  `customerName` VARCHAR(255) NULL,
  `orderCreatedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `CustomerProductHandle_shop_orderId_productHandle_key` (`shop`, `orderId`, `productHandle`),
  INDEX `CustomerProductHandle_shop_orderCreatedAt_idx` (`shop`, `orderCreatedAt`),
  INDEX `CustomerProductHandle_shop_productHandle_idx` (`shop`, `productHandle`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
