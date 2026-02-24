-- AlterTable
ALTER TABLE `NotificationConfig`
  ADD COLUMN `orderDate` VARCHAR(32) NULL AFTER `createOrderTime`;
