-- Onboarding v2.
--
-- Three additions, none of which changes an existing row's meaning:
--   * doctors.listedElsewhere is NULLABLE ON PURPOSE. The question is
--     skippable, so "not answered" must be distinguishable from "no".
--   * clinics.landmark is how an Indian address is actually given.
--   * clinic_facilities.category groups a curated picker's output; NULL is
--     what a practitioner typed themselves.

-- AlterTable
ALTER TABLE `doctors`
  ADD COLUMN `listedElsewhere` BOOLEAN NULL,
  ADD COLUMN `listedElsewhereNames` TEXT NULL;

-- AlterTable
ALTER TABLE `clinics`
  ADD COLUMN `landmark` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `clinic_facilities`
  ADD COLUMN `category` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `doctor_concerns_other` (
    `id` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `doctor_concerns_other_doctorId_name_key`(`doctorId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `doctor_specialty_areas` (
    `id` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `doctor_specialty_areas_doctorId_name_key`(`doctorId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `doctor_concerns_other` ADD CONSTRAINT `doctor_concerns_other_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `doctor_specialty_areas` ADD CONSTRAINT `doctor_specialty_areas_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
