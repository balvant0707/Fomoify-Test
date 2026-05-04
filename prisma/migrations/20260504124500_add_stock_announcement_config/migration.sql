-- CreateTable
CREATE TABLE `stockannouncementconfig` (
    `id`                   INT NOT NULL AUTO_INCREMENT,
    `createdAt`            DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`            DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    `shop`                 VARCHAR(191) NOT NULL,
    `enabled`              BOOLEAN NOT NULL DEFAULT true,
    `productQuantity`      INT NULL,
    `showProductQuantity`  BOOLEAN NOT NULL DEFAULT true,
    `hideOutOfStock`       BOOLEAN NOT NULL DEFAULT false,
    `inStockText`          LONGTEXT NULL,
    `quantityText`         LONGTEXT NULL,
    `outOfStockText`       LONGTEXT NULL,
    `inStockDotColor`      VARCHAR(191) NULL,
    `lowStockDotColor`     VARCHAR(191) NULL,
    `outStockDotColor`     VARCHAR(191) NULL,
    `textColor`            VARCHAR(191) NULL,
    `fontSize`             INT NULL,
    `mobileFontSize`       INT NULL,
    `dotSize`              INT NULL,
    `spacing`              INT NULL,
    `textWeight`           VARCHAR(191) NULL,
    `customClass`          VARCHAR(191) NULL,
    `alignment`            VARCHAR(191) NULL,
    `topMargin`            INT NULL,
    `bottomMargin`         INT NULL,
    `productScope`         VARCHAR(191) NULL,
    `selectedProductsJson` LONGTEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `StockAnnouncementConfig_shop_idx` ON `stockannouncementconfig`(`shop`);
