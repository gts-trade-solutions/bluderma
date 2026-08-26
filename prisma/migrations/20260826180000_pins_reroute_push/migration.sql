-- Three additions, none of which changes an existing row.
--
--   photo_annotations   a pin on a photograph carrying a treatment and an
--                       INDICATIVE price. Kept apart from photo_markups,
--                       which is a clinical reading rather than a quote.
--   appointment_reroutes  one practitioner asking another to take a booking.
--                       A row rather than columns on appointments, because a
--                       hand-over can be proposed, declined and proposed
--                       again, and only the trail answers "why was I moved
--                       twice".
--   push_subscriptions  one browser that has allowed notifications. The
--                       endpoint is the identity: one person on a phone and
--                       a laptop is two rows.

-- CreateTable
CREATE TABLE `photo_annotations` (
    `id` VARCHAR(191) NOT NULL,
    `photoId` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `x` DOUBLE NOT NULL,
    `y` DOUBLE NOT NULL,
    `label` INTEGER NOT NULL,
    `treatment` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `priceInr` INTEGER NULL,
    `sessions` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `photo_annotations_photoId_label_idx`(`photoId`, `label`),
    INDEX `photo_annotations_doctorId_createdAt_idx`(`doctorId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `appointment_reroutes` (
    `id` VARCHAR(191) NOT NULL,
    `appointmentId` VARCHAR(191) NOT NULL,
    `fromDoctorId` VARCHAR(191) NOT NULL,
    `toDoctorId` VARCHAR(191) NOT NULL,
    `reason` TEXT NOT NULL,
    `state` ENUM('PROPOSED', 'ACCEPTED', 'DECLINED', 'WITHDRAWN') NOT NULL DEFAULT 'PROPOSED',
    `proposedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `respondedAt` DATETIME(3) NULL,
    `patientNote` TEXT NULL,

    INDEX `appointment_reroutes_appointmentId_proposedAt_idx`(`appointmentId`, `proposedAt`),
    INDEX `appointment_reroutes_toDoctorId_state_idx`(`toDoctorId`, `state`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `push_subscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `endpoint` VARCHAR(500) NOT NULL,
    `p256dh` TEXT NOT NULL,
    `auth` TEXT NOT NULL,
    `userAgent` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSentAt` DATETIME(3) NULL,

    UNIQUE INDEX `push_subscriptions_endpoint_key`(`endpoint`),
    INDEX `push_subscriptions_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `photo_annotations` ADD CONSTRAINT `photo_annotations_photoId_fkey` FOREIGN KEY (`photoId`) REFERENCES `patient_photos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `photo_annotations` ADD CONSTRAINT `photo_annotations_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointment_reroutes` ADD CONSTRAINT `appointment_reroutes_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointment_reroutes` ADD CONSTRAINT `appointment_reroutes_fromDoctorId_fkey` FOREIGN KEY (`fromDoctorId`) REFERENCES `doctors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointment_reroutes` ADD CONSTRAINT `appointment_reroutes_toDoctorId_fkey` FOREIGN KEY (`toDoctorId`) REFERENCES `doctors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `push_subscriptions` ADD CONSTRAINT `push_subscriptions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
