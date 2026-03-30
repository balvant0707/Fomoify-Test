-- CreateTable
CREATE TABLE `customerreview` (
    `id`           INTEGER NOT NULL AUTO_INCREMENT,
    `shop`         VARCHAR(255) NOT NULL,
    `reviewerName` VARCHAR(255),
    `rating`       INTEGER NOT NULL DEFAULT 0,
    `reviewText`   TEXT,
    `pagePath`     VARCHAR(255),
    `visitorId`    VARCHAR(128),
    `createdAt`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CustomerReview_shop_createdAt_idx`(`shop`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
