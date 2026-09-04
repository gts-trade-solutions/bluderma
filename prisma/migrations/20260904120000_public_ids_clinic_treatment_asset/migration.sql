-- Quotable identifiers for premises, catalogue entries and equipment.
--
-- Doctors, clients, pharmacies, orders and gift cards already carried one.
-- These three did not, so "which branch" and "which laser" — both asked over
-- a phone — could only be answered with a cuid.
--
-- Nullable rather than defaulted: an id has to be generated per row (see
-- lib/publicId.ts), which SQL cannot do, so existing rows are filled by
-- prisma/backfill-public-ids.ts immediately after this runs. The unique index
-- is what makes a collision impossible; the generator retries against it.
ALTER TABLE `clinics` ADD COLUMN `publicId` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `clinics_publicId_key` ON `clinics`(`publicId`);

ALTER TABLE `treatments` ADD COLUMN `publicId` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `treatments_publicId_key` ON `treatments`(`publicId`);

ALTER TABLE `practice_assets` ADD COLUMN `publicId` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `practice_assets_publicId_key` ON `practice_assets`(`publicId`);
