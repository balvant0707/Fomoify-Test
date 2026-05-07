-- CreateTable
CREATE TABLE `visitorannouncementconfig` (
    `id`                   INT NOT NULL AUTO_INCREMENT,
    `createdAt`            DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`            DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    `shop`                 VARCHAR(191) NOT NULL,
    `enabled`              BOOLEAN NOT NULL DEFAULT true,
    `visitorMin`           INT NULL,
    `visitorMax`           INT NULL,
    `template`             LONGTEXT NULL,
    `iconKey`              VARCHAR(191) NULL,
    `iconColor`            VARCHAR(191) NULL,
    `refreshSeconds`       INT NULL,
    `behavior`             VARCHAR(191) NULL,
    `textColor`            VARCHAR(191) NULL,
    `fontSize`             INT NULL,
    `mobileFontSize`       INT NULL,
    `iconSize`             INT NULL,
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
CREATE INDEX `VisitorAnnouncementConfig_shop_idx` ON `visitorannouncementconfig`(`shop`);
