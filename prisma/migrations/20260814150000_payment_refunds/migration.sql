-- AlterTable
ALTER TABLE `payments` ADD COLUMN `refundId` VARCHAR(191) NULL,
    ADD COLUMN `refundReason` TEXT NULL,
    ADD COLUMN `refundedAt` DATETIME(3) NULL,
    ADD COLUMN `refundedById` VARCHAR(191) NULL,
    ADD COLUMN `refundedInr` INTEGER NULL;

