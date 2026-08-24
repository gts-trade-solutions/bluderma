-- CreateTable
CREATE TABLE `patient_photos` (
    `id` VARCHAR(191) NOT NULL,
    `patientUserId` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NULL,
    `appointmentId` VARCHAR(191) NULL,
    `angle` ENUM('FRONT', 'LEFT', 'RIGHT', 'BACK', 'TOP', 'CLOSE_UP', 'OTHER') NOT NULL DEFAULT 'FRONT',
    `url` TEXT NOT NULL,
    `storageKey` TEXT NOT NULL,
    `note` TEXT NULL,
    `capturedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `patient_photos_patientUserId_capturedAt_idx`(`patientUserId`, `capturedAt`),
    INDEX `patient_photos_doctorId_capturedAt_idx`(`doctorId`, `capturedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `photo_markups` (
    `id` VARCHAR(191) NOT NULL,
    `photoId` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `strokes` JSON NOT NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `photo_markups_photoId_doctorId_key`(`photoId`, `doctorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `patient_notes` (
    `id` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `patientUserId` VARCHAR(191) NOT NULL,
    `appointmentId` VARCHAR(191) NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `patient_notes_doctorId_patientUserId_createdAt_idx`(`doctorId`, `patientUserId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gift_card_offers` (
    `id` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `valueInr` INTEGER NOT NULL,
    `priceInr` INTEGER NOT NULL,
    `terms` TEXT NULL,
    `validMonths` INTEGER NOT NULL DEFAULT 12,
    `imageUrl` TEXT NULL,
    `imageKey` TEXT NULL,
    `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN') NOT NULL DEFAULT 'DRAFT',
    `reviewNote` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `reviewedAt` DATETIME(3) NULL,

    INDEX `gift_card_offers_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `gift_card_offers_doctorId_status_idx`(`doctorId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gift_cards` (
    `id` VARCHAR(191) NOT NULL,
    `offerId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `buyerUserId` VARCHAR(191) NOT NULL,
    `recipientName` VARCHAR(191) NULL,
    `recipientEmail` VARCHAR(191) NULL,
    `message` TEXT NULL,
    `valueInr` INTEGER NOT NULL,
    `balanceInr` INTEGER NOT NULL,
    `paymentId` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `gift_cards_code_key`(`code`),
    INDEX `gift_cards_buyerUserId_createdAt_idx`(`buyerUserId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gift_card_redemptions` (
    `id` VARCHAR(191) NOT NULL,
    `giftCardId` VARCHAR(191) NOT NULL,
    `amountInr` INTEGER NOT NULL,
    `doctorId` VARCHAR(191) NULL,
    `appointmentId` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `redeemedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `gift_card_redemptions_giftCardId_redeemedAt_idx`(`giftCardId`, `redeemedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `medicines` (
    `id` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `brand` VARCHAR(191) NULL,
    `form` VARCHAR(191) NULL,
    `strength` VARCHAR(191) NULL,
    `about` TEXT NULL,
    `priceInr` INTEGER NOT NULL,
    `mrpInr` INTEGER NULL,
    `stock` INTEGER NULL,
    `prescriptionOnly` BOOLEAN NOT NULL DEFAULT true,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `medicines_doctorId_isActive_idx`(`doctorId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `medicine_orders` (
    `id` VARCHAR(191) NOT NULL,
    `publicId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NULL,
    `status` ENUM('PLACED', 'CONFIRMED', 'DISPATCHED', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'PLACED',
    `deliverTo` TEXT NOT NULL,
    `phone` VARCHAR(191) NULL,
    `subtotalInr` INTEGER NOT NULL,
    `deliveryInr` INTEGER NOT NULL DEFAULT 0,
    `totalInr` INTEGER NOT NULL,
    `prescriptionUrl` TEXT NULL,
    `prescriptionKey` TEXT NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `medicine_orders_publicId_key`(`publicId`),
    INDEX `medicine_orders_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `medicine_orders_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `medicine_order_items` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `medicineId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `priceInr` INTEGER NOT NULL,
    `qty` INTEGER NOT NULL DEFAULT 1,

    INDEX `medicine_order_items_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `patient_photos` ADD CONSTRAINT `patient_photos_patientUserId_fkey` FOREIGN KEY (`patientUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `patient_photos` ADD CONSTRAINT `patient_photos_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `photo_markups` ADD CONSTRAINT `photo_markups_photoId_fkey` FOREIGN KEY (`photoId`) REFERENCES `patient_photos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `patient_notes` ADD CONSTRAINT `patient_notes_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `patient_notes` ADD CONSTRAINT `patient_notes_patientUserId_fkey` FOREIGN KEY (`patientUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gift_card_offers` ADD CONSTRAINT `gift_card_offers_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gift_card_offers` ADD CONSTRAINT `gift_card_offers_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `clinics`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gift_cards` ADD CONSTRAINT `gift_cards_offerId_fkey` FOREIGN KEY (`offerId`) REFERENCES `gift_card_offers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gift_cards` ADD CONSTRAINT `gift_cards_buyerUserId_fkey` FOREIGN KEY (`buyerUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gift_card_redemptions` ADD CONSTRAINT `gift_card_redemptions_giftCardId_fkey` FOREIGN KEY (`giftCardId`) REFERENCES `gift_cards`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medicines` ADD CONSTRAINT `medicines_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medicine_orders` ADD CONSTRAINT `medicine_orders_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medicine_order_items` ADD CONSTRAINT `medicine_order_items_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `medicine_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medicine_order_items` ADD CONSTRAINT `medicine_order_items_medicineId_fkey` FOREIGN KEY (`medicineId`) REFERENCES `medicines`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

