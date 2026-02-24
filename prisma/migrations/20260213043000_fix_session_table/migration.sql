-- Ensure Shopify Prisma session table exists with the expected lowercase name.
-- Legacy deployments may have `Session` (capital S), which fails on case-sensitive MySQL.

SET @has_session := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'session'
);

SET @has_Session := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'Session'
);

SET @rename_sql := IF(
  @has_session = 0 AND @has_Session = 1,
  'RENAME TABLE `Session` TO `session`',
  'SELECT 1'
);

PREPARE stmt FROM @rename_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `session` (
  `id` VARCHAR(255) NOT NULL,
  `shop` VARCHAR(255) NOT NULL,
  `state` VARCHAR(255) NOT NULL,
  `isOnline` BOOLEAN NOT NULL DEFAULT false,
  `scope` TEXT NULL,
  `expires` DATETIME(3) NULL,
  `accessToken` TEXT NOT NULL,
  `userId` BIGINT NULL,
  `firstName` VARCHAR(191) NULL,
  `lastName` VARCHAR(191) NULL,
  `email` VARCHAR(320) NULL,
  `accountOwner` BOOLEAN NOT NULL DEFAULT false,
  `locale` VARCHAR(20) NULL,
  `collaborator` BOOLEAN NULL DEFAULT false,
  `emailVerified` BOOLEAN NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
