-- CreateTable
CREATE TABLE `hub_categories` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `icon` VARCHAR(191) NOT NULL,
    `blurb` TEXT NOT NULL,
    `intro` TEXT NOT NULL,
    `image` TEXT NOT NULL,
    `tint` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `hub_categories_slug_key`(`slug`),
    INDEX `hub_categories_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hub_treatments` (
    `id` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `blurb` TEXT NOT NULL,
    `image` TEXT NOT NULL,
    `meta` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `hub_treatments_categoryId_sortOrder_idx`(`categoryId`, `sortOrder`),
    UNIQUE INDEX `hub_treatments_categoryId_slug_key`(`categoryId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `treatment_protocols` (
    `id` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `recommendedFor` JSON NOT NULL,
    `summary` TEXT NOT NULL,
    `howItWorks` TEXT NOT NULL,
    `options` JSON NOT NULL,
    `areas` JSON NOT NULL,
    `duration` VARCHAR(191) NOT NULL,
    `anaesthesia` VARCHAR(191) NOT NULL,
    `sessions` VARCHAR(191) NOT NULL,
    `downtime` VARCHAR(191) NOT NULL,
    `results` TEXT NOT NULL,
    `includes` JSON NOT NULL,
    `excludes` JSON NOT NULL,
    `precautions` JSON NOT NULL,
    `sideEffects` JSON NOT NULL,
    `notSuitable` JSON NOT NULL,
    `aftercare` JSON NOT NULL,
    `faqs` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `treatment_protocols_categoryId_key`(`categoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `hub_treatments` ADD CONSTRAINT `hub_treatments_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `hub_categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `treatment_protocols` ADD CONSTRAINT `treatment_protocols_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `hub_categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

