-- AlterTable
ALTER TABLE `hub_promos` DROP COLUMN `ctaHref`,
    DROP COLUMN `ctaLabel`,
    ADD COLUMN `cta` VARCHAR(191) NOT NULL,
    ADD COLUMN `href` VARCHAR(191) NOT NULL,
    MODIFY `eyebrow` VARCHAR(191) NOT NULL,
    MODIFY `body` TEXT NOT NULL;

