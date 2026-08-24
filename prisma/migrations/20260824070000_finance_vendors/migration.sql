-- CreateTable
CREATE TABLE `medicine_vendors` (
    `id` VARCHAR(191) NOT NULL,
    `publicId` VARCHAR(191) NULL,
    `businessName` VARCHAR(191) NOT NULL,
    `contactName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `addressLine1` VARCHAR(191) NOT NULL,
    `addressLine2` VARCHAR(191) NULL,
    `area` VARCHAR(191) NULL,
    `city` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `pincode` VARCHAR(191) NOT NULL,
    `drugLicenceNo` VARCHAR(191) NOT NULL,
    `drugLicenceUrl` TEXT NULL,
    `drugLicenceKey` TEXT NULL,
    `gstin` VARCHAR(191) NULL,
    `categories` TEXT NULL,
    `about` TEXT NULL,
    `status` ENUM('SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'SUBMITTED',
    `reviewNote` TEXT NULL,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewedAt` DATETIME(3) NULL,

    UNIQUE INDEX `medicine_vendors_publicId_key`(`publicId`),
    INDEX `medicine_vendors_status_submittedAt_idx`(`status`, `submittedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `practice_expenses` (
    `id` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NULL,
    `category` ENUM('RENT', 'SALARY', 'CONSUMABLES', 'MARKETING', 'UTILITIES', 'MAINTENANCE', 'TAX', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `label` VARCHAR(191) NOT NULL,
    `amountInr` INTEGER NOT NULL,
    `spentOn` DATETIME(3) NOT NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `practice_expenses_doctorId_spentOn_idx`(`doctorId`, `spentOn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `practice_assets` (
    `id` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `purpose` VARCHAR(191) NULL,
    `costInr` INTEGER NOT NULL,
    `purchasedOn` DATETIME(3) NOT NULL,
    `upkeepInr` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `practice_assets_doctorId_isActive_idx`(`doctorId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_usages` (
    `id` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `usedOn` DATETIME(3) NOT NULL,
    `chargedInr` INTEGER NOT NULL DEFAULT 0,
    `treatment` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `asset_usages_assetId_usedOn_idx`(`assetId`, `usedOn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `practice_expenses` ADD CONSTRAINT `practice_expenses_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `practice_expenses` ADD CONSTRAINT `practice_expenses_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `clinics`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `practice_assets` ADD CONSTRAINT `practice_assets_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `practice_assets` ADD CONSTRAINT `practice_assets_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `clinics`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_usages` ADD CONSTRAINT `asset_usages_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `practice_assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

