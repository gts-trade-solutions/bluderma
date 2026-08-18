-- AlterTable
ALTER TABLE `appointments` ADD COLUMN `visitFee` INTEGER NOT NULL DEFAULT 0,
    MODIFY `mode` ENUM('CLINIC', 'VIDEO', 'HOME') NOT NULL;

-- AlterTable
ALTER TABLE `doctor_modes` DROP PRIMARY KEY,
    MODIFY `mode` ENUM('CLINIC', 'VIDEO', 'HOME') NOT NULL,
    ADD PRIMARY KEY (`doctorId`, `mode`);

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(191) NOT NULL,
    `appointmentId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `provider` VARCHAR(191) NOT NULL DEFAULT 'razorpay',
    `providerOrderId` VARCHAR(191) NOT NULL,
    `providerPaymentId` VARCHAR(191) NULL,
    `signature` VARCHAR(191) NULL,
    `amountInr` INTEGER NOT NULL,
    `amountMinor` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `status` ENUM('CREATED', 'PAID', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'CREATED',
    `failureReason` TEXT NULL,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payments_providerOrderId_key`(`providerOrderId`),
    UNIQUE INDEX `payments_providerPaymentId_key`(`providerPaymentId`),
    INDEX `payments_appointmentId_createdAt_idx`(`appointmentId`, `createdAt`),
    INDEX `payments_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

