-- CreateTable
CREATE TABLE `treatment_plans` (
    `id` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `patientUserId` VARCHAR(191) NOT NULL,
    `scanId` VARCHAR(191) NULL,
    `appointmentId` VARCHAR(191) NULL,
    `sharedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `treatment_plans_doctorId_createdAt_idx`(`doctorId`, `createdAt`),
    INDEX `treatment_plans_patientUserId_sharedAt_idx`(`patientUserId`, `sharedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `treatment_plan_items` (
    `id` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `treatment` VARCHAR(191) NOT NULL,
    `rationale` TEXT NULL,
    `source` ENUM('AI', 'DOCTOR') NOT NULL DEFAULT 'AI',
    `state` ENUM('SUGGESTED', 'ACCEPTED', 'DECLINED') NOT NULL DEFAULT 'SUGGESTED',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `treatment_plan_items_planId_sortOrder_idx`(`planId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `doctor_gallery_cases` (
    `id` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `treatmentName` VARCHAR(191) NOT NULL,
    `caption` TEXT NULL,
    `detail` TEXT NULL,
    `beforeUrl` TEXT NOT NULL,
    `beforeKey` TEXT NOT NULL,
    `afterUrl` TEXT NOT NULL,
    `afterKey` TEXT NOT NULL,
    `patientUserId` VARCHAR(191) NOT NULL,
    `consentRequestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `consentGivenAt` DATETIME(3) NULL,
    `consentWithdrawnAt` DATETIME(3) NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'HIDDEN') NOT NULL DEFAULT 'DRAFT',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `doctor_gallery_cases_doctorId_status_sortOrder_idx`(`doctorId`, `status`, `sortOrder`),
    INDEX `doctor_gallery_cases_patientUserId_consentGivenAt_idx`(`patientUserId`, `consentGivenAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `treatment_plans` ADD CONSTRAINT `treatment_plans_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `treatment_plans` ADD CONSTRAINT `treatment_plans_patientUserId_fkey` FOREIGN KEY (`patientUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `treatment_plans` ADD CONSTRAINT `treatment_plans_scanId_fkey` FOREIGN KEY (`scanId`) REFERENCES `skin_scans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `treatment_plan_items` ADD CONSTRAINT `treatment_plan_items_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `treatment_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `doctor_gallery_cases` ADD CONSTRAINT `doctor_gallery_cases_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `doctor_gallery_cases` ADD CONSTRAINT `doctor_gallery_cases_patientUserId_fkey` FOREIGN KEY (`patientUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

