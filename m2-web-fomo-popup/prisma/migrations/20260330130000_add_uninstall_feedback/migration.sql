-- CreateTable
CREATE TABLE `uninstallfeedback` (
    `id`            INTEGER NOT NULL AUTO_INCREMENT,
    `shop`          VARCHAR(255) NOT NULL,
    `ownerName`     VARCHAR(255),
    `email`         VARCHAR(320),
    `contactEmail`  VARCHAR(320),
    `uninstalledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UninstallFeedback_shop_idx`(`shop`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
