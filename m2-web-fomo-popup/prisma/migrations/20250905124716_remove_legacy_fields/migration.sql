/*
  Warnings:

  - You are about to drop the column `location` on the `notificationconfig` table. All the data in the column will be lost.
  - You are about to drop the column `messageTitle` on the `notificationconfig` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `notificationconfig` table. All the data in the column will be lost.
  - You are about to drop the column `productHandle` on the `notificationconfig` table. All the data in the column will be lost.
  - You are about to drop the column `productHandlesJson` on the `notificationconfig` table. All the data in the column will be lost.

*/
-- AlterTable (safe on partially-migrated DBs)
ALTER TABLE `notificationconfig`
  DROP COLUMN IF EXISTS `location`,
  DROP COLUMN IF EXISTS `messageTitle`,
  DROP COLUMN IF EXISTS `name`,
  DROP COLUMN IF EXISTS `productHandle`,
  DROP COLUMN IF EXISTS `productHandlesJson`;

-- AlterTable
ALTER TABLE `session` ALTER COLUMN `updatedAt` DROP DEFAULT;
