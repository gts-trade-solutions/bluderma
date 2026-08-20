-- AlterTable
ALTER TABLE `appointments` ADD COLUMN `skinScanId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_skinScanId_fkey` FOREIGN KEY (`skinScanId`) REFERENCES `skin_scans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

