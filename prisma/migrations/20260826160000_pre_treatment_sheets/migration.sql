-- Pre-treatment sheets.
--
-- One model carries both sides of the treatment, because they are the same
-- document with a different date on it. POST is the default on both tables:
-- every row that existed before this column did was an aftercare sheet, and a
-- default that rewrites history is a default that lies.

-- AlterTable
ALTER TABLE `aftercare_notes`
  ADD COLUMN `kind` ENUM('PRE', 'POST') NOT NULL DEFAULT 'POST';

-- The unique on aftercare_notes widens to include the kind, so a doctor can
-- keep separate standing notes for before and after the same treatment.
--
-- ORDER MATTERS. MySQL uses the leftmost prefix of an index to satisfy a
-- foreign key, and the old unique (doctorId, treatmentKey) is what supports
-- the doctorId FK. Dropping it first fails with "needed in a foreign key
-- constraint". The replacement also leads with doctorId, so creating it first
-- leaves the FK supported throughout.

-- CreateIndex
CREATE UNIQUE INDEX `aftercare_notes_doctorId_treatmentKey_kind_key` ON `aftercare_notes`(`doctorId`, `treatmentKey`, `kind`);

-- DropIndex
ALTER TABLE `aftercare_notes` DROP INDEX `aftercare_notes_doctorId_treatmentKey_key`;

-- AlterTable
ALTER TABLE `aftercare_sheets`
  ADD COLUMN `kind` ENUM('PRE', 'POST') NOT NULL DEFAULT 'POST',
  ADD COLUMN `arriveAt` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `aftercare_sheets_kind_issuedAt_idx` ON `aftercare_sheets`(`kind`, `issuedAt`);
