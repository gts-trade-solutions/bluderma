-- CreateTable
CREATE TABLE `skin_scans` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `analyzerAnalysisId` VARCHAR(191) NOT NULL,
    `grantId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'done',
    `kind` VARCHAR(191) NOT NULL DEFAULT 'face',
    `summary` JSON NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `skin_scans_analyzerAnalysisId_key`(`analyzerAnalysisId`),
    INDEX `skin_scans_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `skin_scan_issues` (
    `id` VARCHAR(191) NOT NULL,
    `scanId` VARCHAR(191) NOT NULL,
    `issueType` VARCHAR(191) NOT NULL,
    `score` DOUBLE NULL,
    `confidence` DOUBLE NULL,
    `severityBand` VARCHAR(191) NULL,
    `details` JSON NULL,

    INDEX `skin_scan_issues_scanId_idx`(`scanId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `skin_entitlements` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL DEFAULT 'available',
    `expiresAt` DATETIME(3) NULL,
    `reservedAt` DATETIME(3) NULL,
    `consumedAt` DATETIME(3) NULL,
    `releasedAt` DATETIME(3) NULL,
    `analysisId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `skin_entitlements_userId_state_idx`(`userId`, `state`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `skin_access_requests` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `note` TEXT NULL,
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `skin_access_requests_userId_status_idx`(`userId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `skin_scans` ADD CONSTRAINT `skin_scans_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `skin_scan_issues` ADD CONSTRAINT `skin_scan_issues_scanId_fkey` FOREIGN KEY (`scanId`) REFERENCES `skin_scans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `skin_entitlements` ADD CONSTRAINT `skin_entitlements_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `skin_access_requests` ADD CONSTRAINT `skin_access_requests_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
