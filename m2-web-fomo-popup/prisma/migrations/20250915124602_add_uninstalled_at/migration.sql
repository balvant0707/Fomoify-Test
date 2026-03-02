-- AlterTable
ALTER TABLE `session` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `shop` ADD COLUMN `uninstalledAt` DATETIME(3) NULL,
    MODIFY `installed` BOOLEAN NOT NULL DEFAULT false;
