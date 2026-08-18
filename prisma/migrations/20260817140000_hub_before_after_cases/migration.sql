CREATE TABLE `hub_before_after_cases` (
  `id` VARCHAR(191) NOT NULL,
  `treatmentId` VARCHAR(191) NOT NULL,
  `beforeImage` TEXT NOT NULL,
  `afterImage` TEXT NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `hub_before_after_cases_treatmentId_sortOrder_key`(`treatmentId`, `sortOrder`),
  INDEX `hub_before_after_cases_treatmentId_sortOrder_idx`(`treatmentId`, `sortOrder`),
  PRIMARY KEY (`id`),
  CONSTRAINT `hub_before_after_cases_treatmentId_fkey`
    FOREIGN KEY (`treatmentId`) REFERENCES `hub_treatments`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
