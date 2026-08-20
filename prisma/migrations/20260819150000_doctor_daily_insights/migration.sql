-- CreateTable
CREATE TABLE `doctor_daily_insights` (
    `id` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `dateKey` VARCHAR(191) NOT NULL,
    `metricsHash` VARCHAR(191) NOT NULL,
    `items` JSON NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `doctor_daily_insights_doctorId_createdAt_idx`(`doctorId`, `createdAt`),
    UNIQUE INDEX `doctor_daily_insights_doctorId_dateKey_key`(`doctorId`, `dateKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `doctor_daily_insights` ADD CONSTRAINT `doctor_daily_insights_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

