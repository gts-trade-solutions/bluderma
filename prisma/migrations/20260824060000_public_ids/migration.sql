-- AlterTable
ALTER TABLE `doctors` ADD COLUMN `publicId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `publicId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `doctors_publicId_key` ON `doctors`(`publicId`);

-- CreateIndex
CREATE UNIQUE INDEX `users_publicId_key` ON `users`(`publicId`);

