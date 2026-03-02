-- AlterTable
ALTER TABLE `session` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- CreateTable
CREATE TABLE `NotificationConfig` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `shop` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `showType` VARCHAR(191) NULL,
    `messageTitle` VARCHAR(191) NULL,
    `location` VARCHAR(191) NULL,
    `name` VARCHAR(191) NULL,
    `messageText` VARCHAR(191) NULL,
    `fontFamily` VARCHAR(191) NULL,
    `position` VARCHAR(191) NULL,
    `animation` VARCHAR(191) NULL,
    `mobileSize` VARCHAR(191) NULL,
    `mobilePositionJson` VARCHAR(191) NULL,
    `titleColor` VARCHAR(191) NULL,
    `bgColor` VARCHAR(191) NULL,
    `msgColor` VARCHAR(191) NULL,
    `ctaBgColor` VARCHAR(191) NULL,
    `rounded` INTEGER NULL,
    `durationSeconds` INTEGER NULL,
    `alternateSeconds` INTEGER NULL,
    `fontWeight` INTEGER NULL,
    `productHandle` VARCHAR(191) NOT NULL,
    `messageTitlesJson` LONGTEXT NULL,
    `locationsJson` LONGTEXT NULL,
    `namesJson` LONGTEXT NULL,
    `selectedProductsJson` LONGTEXT NULL,
    `iconKey` VARCHAR(191) NULL,
    `iconSvg` LONGTEXT NULL,

    INDEX `NotificationConfig_shop_key_idx`(`shop`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `NotificationConfig`
  ADD COLUMN `orderDays` INT NULL DEFAULT 7 AFTER `messageTitlesJson`,
  ADD COLUMN `createOrderTime` VARCHAR(32) NULL AFTER `orderDays`;