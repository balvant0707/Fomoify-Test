-- CreateTable
CREATE TABLE `PopupAnalyticsEvent` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `shop` VARCHAR(255) NOT NULL,
  `popupType` VARCHAR(32) NOT NULL,
  `eventType` VARCHAR(32) NOT NULL,
  `visitorId` VARCHAR(128) NULL,
  `productHandle` VARCHAR(128) NULL,
  `pagePath` VARCHAR(255) NULL,
  `sourceUrl` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `PopupAnalyticsEvent_shop_createdAt_idx` ON `PopupAnalyticsEvent`(`shop`, `createdAt`);

-- CreateIndex
CREATE INDEX `PopupAnalyticsEvent_shop_type_event_createdAt_idx` ON `PopupAnalyticsEvent`(`shop`, `popupType`, `eventType`, `createdAt`);

-- CreateIndex
CREATE INDEX `PopupAnalyticsEvent_shop_visitorId_idx` ON `PopupAnalyticsEvent`(`shop`, `visitorId`);
