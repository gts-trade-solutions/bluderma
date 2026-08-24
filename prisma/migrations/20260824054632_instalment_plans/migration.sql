-- CreateTable
CREATE TABLE `instalment_plans` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `item` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `totalInr` INTEGER NOT NULL,
    `instalmentInr` INTEGER NOT NULL,
    `instalmentsTotal` INTEGER NOT NULL,
    `instalmentsPaid` INTEGER NOT NULL DEFAULT 0,
    `nextDueAt` DATETIME(3) NULL,
    `settledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `instalment_plans_userId_settledAt_idx`(`userId`, `settledAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `instalment_plans` ADD CONSTRAINT `instalment_plans_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
