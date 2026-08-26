-- Money detail, and a real dispensary.
--
-- Nothing here changes the meaning of an existing row. The two new expense
-- categories are added to the enum rather than replacing anything, and OTHER
-- is deliberately kept: live rows carry it, and the word a practitioner reads
-- ("Miscellaneous") is decided by categoryLabel() rather than by the database.
--
-- The one behavioural change is the stock ledger. medicines.stock was READ by
-- the order flow and never written, so a practice could accept fifty orders
-- against ten units. stock_movements backfills nothing for history that was
-- never recorded; it starts from today, and the current count is taken as the
-- opening balance.

-- AlterTable
ALTER TABLE `practice_expenses`
  ADD COLUMN `headcount` INTEGER NULL,
  MODIFY `category` ENUM('RENT', 'SALARY', 'CONSUMABLES', 'MARKETING', 'UTILITIES', 'MAINTENANCE', 'TAX', 'MEDICINES', 'LAUNDRY', 'OTHER') NOT NULL DEFAULT 'OTHER';

-- AlterTable
ALTER TABLE `medicines`
  ADD COLUMN `lowStockAt` INTEGER NULL;

-- AlterTable
ALTER TABLE `prescriptions`
  ADD COLUMN `appointmentId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `prescriptions_appointmentId_idx` ON `prescriptions`(`appointmentId`);

-- CreateIndex
CREATE INDEX `medicine_orders_doctorId_createdAt_idx` ON `medicine_orders`(`doctorId`, `createdAt`);

-- CreateTable
CREATE TABLE `practice_income` (
    `id` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NULL,
    `source` ENUM('PRODUCT', 'PACKAGE', 'RENTAL', 'PROFESSIONAL', 'MISCELLANEOUS') NOT NULL DEFAULT 'MISCELLANEOUS',
    `label` VARCHAR(191) NOT NULL,
    `amountInr` INTEGER NOT NULL,
    `receivedOn` DATETIME(3) NOT NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `practice_income_doctorId_receivedOn_idx`(`doctorId`, `receivedOn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_movements` (
    `id` VARCHAR(191) NOT NULL,
    `medicineId` VARCHAR(191) NOT NULL,
    `delta` INTEGER NOT NULL,
    `balance` INTEGER NOT NULL,
    `reason` ENUM('RECEIVED', 'DISPENSED', 'ORDER', 'ORDER_CANCELLED', 'CORRECTION', 'EXPIRED', 'DAMAGED') NOT NULL,
    `note` TEXT NULL,
    `orderId` VARCHAR(191) NULL,
    `actorUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `stock_movements_medicineId_createdAt_idx`(`medicineId`, `createdAt`),
    INDEX `stock_movements_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prescription_items` (
    `id` VARCHAR(191) NOT NULL,
    `prescriptionId` VARCHAR(191) NOT NULL,
    `medicineId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `strength` VARCHAR(191) NULL,
    `form` VARCHAR(191) NULL,
    `dose` VARCHAR(191) NULL,
    `duration` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `prescription_items_prescriptionId_sortOrder_idx`(`prescriptionId`, `sortOrder`),
    INDEX `prescription_items_medicineId_idx`(`medicineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `practice_income` ADD CONSTRAINT `practice_income_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `practice_income` ADD CONSTRAINT `practice_income_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `clinics`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_medicineId_fkey` FOREIGN KEY (`medicineId`) REFERENCES `medicines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prescription_items` ADD CONSTRAINT `prescription_items_prescriptionId_fkey` FOREIGN KEY (`prescriptionId`) REFERENCES `prescriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prescription_items` ADD CONSTRAINT `prescription_items_medicineId_fkey` FOREIGN KEY (`medicineId`) REFERENCES `medicines`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
