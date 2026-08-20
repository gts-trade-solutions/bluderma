-- AlterTable
ALTER TABLE `appointments` ADD COLUMN `allergies` TEXT NULL,
    ADD COLUMN `isFirstVisit` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `medications` TEXT NULL,
    ADD COLUMN `patientAge` INTEGER NULL,
    ADD COLUMN `patientGender` ENUM('FEMALE', 'MALE', 'OTHER', 'UNDISCLOSED') NULL,
    ADD COLUMN `photoConsent` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `priorTreatment` TEXT NULL,
    ADD COLUMN `reason` ENUM('ACNE', 'PIGMENTATION', 'HAIR_LOSS', 'ANTI_AGEING', 'SCARS', 'ROSACEA_REDNESS', 'ECZEMA_PSORIASIS', 'FUNGAL_INFECTION', 'MOLE_CHECK', 'COSMETIC_PROCEDURE', 'FOLLOW_UP', 'OTHER') NULL,
    ADD COLUMN `reasonDetail` TEXT NULL,
    ADD COLUMN `severity` INTEGER NULL,
    ADD COLUMN `skinAnalysisId` VARCHAR(191) NULL,
    ADD COLUMN `symptomDuration` ENUM('UNDER_WEEK', 'WEEKS_1_4', 'MONTHS_1_6', 'MONTHS_6_12', 'OVER_YEAR') NULL;

-- AlterTable
ALTER TABLE `doctors` ADD COLUMN `facebook` VARCHAR(191) NULL,
    ADD COLUMN `instagram` VARCHAR(191) NULL,
    ADD COLUMN `linkedin` VARCHAR(191) NULL,
    ADD COLUMN `youtube` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_skinAnalysisId_fkey` FOREIGN KEY (`skinAnalysisId`) REFERENCES `skin_analyses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

