-- DropIndex
DROP INDEX `doctor_availability_doctorId_dayOfWeek_startTime_key` ON `doctor_availability`;

-- AlterTable
ALTER TABLE `appointments` ADD COLUMN `approvalState` ENUM('AUTO', 'AWAITING_DOCTOR', 'ACCEPTED', 'DECLINED') NOT NULL DEFAULT 'AUTO',
    ADD COLUMN `approvedAt` DATETIME(3) NULL,
    ADD COLUMN `cancelledBy` ENUM('PATIENT', 'DOCTOR', 'ADMIN', 'SYSTEM') NULL,
    ADD COLUMN `clinicId` VARCHAR(191) NULL,
    ADD COLUMN `declineReason` TEXT NULL,
    ADD COLUMN `discountInr` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `isPriority` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `meetingUrl` TEXT NULL,
    ADD COLUMN `rescheduledBy` ENUM('PATIENT', 'DOCTOR', 'ADMIN', 'SYSTEM') NULL,
    ADD COLUMN `subscriptionId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `doctor_availability` ADD COLUMN `clinicId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `doctors` ADD COLUMN `licenceDocUrl` TEXT NULL,
    ADD COLUMN `priorityHoldPerDay` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `regCouncil` VARCHAR(191) NULL,
    ADD COLUMN `regNumber` VARCHAR(191) NULL,
    ADD COLUMN `regYear` INTEGER NULL,
    ADD COLUMN `rejectionReason` TEXT NULL,
    ADD COLUMN `requiresApproval` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `reviewedAt` DATETIME(3) NULL,
    ADD COLUMN `reviewedById` VARCHAR(191) NULL,
    ADD COLUMN `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED') NOT NULL DEFAULT 'APPROVED',
    ADD COLUMN `submittedAt` DATETIME(3) NULL,
    ADD COLUMN `travelBufferMin` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `payments` ADD COLUMN `subscriptionId` VARCHAR(191) NULL,
    MODIFY `purpose` ENUM('APPOINTMENT', 'SKIN_SCAN', 'SUBSCRIPTION') NOT NULL DEFAULT 'APPOINTMENT';

-- CreateTable
CREATE TABLE `clinics` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `addressLine1` VARCHAR(191) NOT NULL,
    `addressLine2` VARCHAR(191) NULL,
    `area` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL DEFAULT 'Tamil Nadu',
    `pincode` VARCHAR(191) NOT NULL,
    `lat` DOUBLE NULL,
    `lng` DOUBLE NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `colorKey` VARCHAR(191) NOT NULL DEFAULT 'blue',
    `about` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `clinics_slug_key`(`slug`),
    INDEX `clinics_isActive_city_idx`(`isActive`, `city`),
    INDEX `clinics_city_area_idx`(`city`, `area`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clinic_photos` (
    `id` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `url` TEXT NOT NULL,
    `kind` ENUM('EXTERIOR', 'INTERIOR', 'ROOM') NOT NULL DEFAULT 'INTERIOR',
    `alt` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `clinic_photos_clinicId_kind_sortOrder_idx`(`clinicId`, `kind`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clinic_facilities` (
    `id` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `clinic_facilities_clinicId_name_key`(`clinicId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `doctor_clinics` (
    `doctorId` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `feeInr` INTEGER NOT NULL DEFAULT 0,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `doctor_clinics_clinicId_isActive_idx`(`clinicId`, `isActive`),
    INDEX `doctor_clinics_doctorId_isPrimary_idx`(`doctorId`, `isPrimary`),
    PRIMARY KEY (`doctorId`, `clinicId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_plans` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `interval` ENUM('MONTHLY', 'ANNUAL') NOT NULL DEFAULT 'MONTHLY',
    `priceInr` INTEGER NOT NULL,
    `compareAtInr` INTEGER NULL,
    `discountPercent` INTEGER NOT NULL DEFAULT 0,
    `scanCredits` INTEGER NOT NULL DEFAULT 0,
    `priorityBooking` BOOLEAN NOT NULL DEFAULT false,
    `waiveCancellationFee` BOOLEAN NOT NULL DEFAULT false,
    `perks` JSON NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `subscription_plans_slug_key`(`slug`),
    INDEX `subscription_plans_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `currentPeriodEnd` DATETIME(3) NOT NULL,
    `cancelledAt` DATETIME(3) NULL,
    `autoRenew` BOOLEAN NOT NULL DEFAULT false,
    `razorpaySubscriptionId` VARCHAR(191) NULL,
    `renewalNoticeSentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `subscriptions_razorpaySubscriptionId_key`(`razorpaySubscriptionId`),
    INDEX `subscriptions_userId_status_idx`(`userId`, `status`),
    INDEX `subscriptions_status_currentPeriodEnd_idx`(`status`, `currentPeriodEnd`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `appointments_clinicId_scheduledAt_idx` ON `appointments`(`clinicId`, `scheduledAt`);

-- CreateIndex
CREATE INDEX `appointments_doctorId_approvalState_idx` ON `appointments`(`doctorId`, `approvalState`);

-- CreateIndex
CREATE INDEX `doctor_availability_clinicId_idx` ON `doctor_availability`(`clinicId`);

-- CreateIndex
CREATE UNIQUE INDEX `doctor_availability_doctorId_clinicId_dayOfWeek_startTime_key` ON `doctor_availability`(`doctorId`, `clinicId`, `dayOfWeek`, `startTime`);

-- CreateIndex
CREATE INDEX `doctors_status_isActive_idx` ON `doctors`(`status`, `isActive`);

-- CreateIndex
CREATE INDEX `payments_subscriptionId_idx` ON `payments`(`subscriptionId`);

-- AddForeignKey
ALTER TABLE `doctor_availability` ADD CONSTRAINT `doctor_availability_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `clinics`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `clinics`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clinic_photos` ADD CONSTRAINT `clinic_photos_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `clinics`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clinic_facilities` ADD CONSTRAINT `clinic_facilities_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `clinics`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `doctor_clinics` ADD CONSTRAINT `doctor_clinics_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `doctor_clinics` ADD CONSTRAINT `doctor_clinics_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `clinics`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `subscription_plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

