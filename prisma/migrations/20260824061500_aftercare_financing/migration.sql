-- CreateTable
CREATE TABLE `aftercare_notes` (
    `id` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `treatmentKey` VARCHAR(191) NOT NULL,
    `treatmentName` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `aftercare_notes_doctorId_treatmentKey_key`(`doctorId`, `treatmentKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `aftercare_sheets` (
    `id` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `patientUserId` VARCHAR(191) NULL,
    `appointmentId` VARCHAR(191) NULL,
    `patientName` VARCHAR(191) NOT NULL,
    `patientPublicId` VARCHAR(191) NULL,
    `doctorName` VARCHAR(191) NOT NULL,
    `doctorPublicId` VARCHAR(191) NULL,
    `clinicName` VARCHAR(191) NULL,
    `clinicContact` VARCHAR(191) NULL,
    `procedure` VARCHAR(191) NOT NULL,
    `procedureDate` DATETIME(3) NOT NULL,
    `reviewOn` DATETIME(3) NULL,
    `intro` TEXT NOT NULL,
    `dos` JSON NOT NULL,
    `donts` JSON NOT NULL,
    `warnings` JSON NOT NULL,
    `doctorNotes` TEXT NULL,
    `emergencyContact` VARCHAR(191) NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `acknowledgedAt` DATETIME(3) NULL,

    INDEX `aftercare_sheets_patientUserId_issuedAt_idx`(`patientUserId`, `issuedAt`),
    INDEX `aftercare_sheets_doctorId_issuedAt_idx`(`doctorId`, `issuedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `financing_requests` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `treatment` VARCHAR(191) NOT NULL,
    `estimatedInr` INTEGER NULL,
    `note` TEXT NULL,
    `status` ENUM('NEW', 'CONTACTED', 'CLOSED') NOT NULL DEFAULT 'NEW',
    `staffNote` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `respondedAt` DATETIME(3) NULL,

    INDEX `financing_requests_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `financing_requests_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `aftercare_notes` ADD CONSTRAINT `aftercare_notes_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `aftercare_sheets` ADD CONSTRAINT `aftercare_sheets_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `aftercare_sheets` ADD CONSTRAINT `aftercare_sheets_patientUserId_fkey` FOREIGN KEY (`patientUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `aftercare_sheets` ADD CONSTRAINT `aftercare_sheets_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financing_requests` ADD CONSTRAINT `financing_requests_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

