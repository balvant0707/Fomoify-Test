-- AlterTable
ALTER TABLE `session` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `shop` ADD COLUMN `onboardedAt` DATETIME(3) NULL;
