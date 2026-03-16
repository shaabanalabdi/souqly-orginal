-- B-01j: Escrow webhook ledger + idempotency hardening
-- Safe migration notes:
-- 1) Create append-style webhook ledger table with unique eventId.
-- 2) Support processing state transitions (RECEIVED -> PROCESSED/FAILED).

CREATE TABLE `escrow_webhook_events` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `eventId` VARCHAR(120) NOT NULL,
  `eventType` VARCHAR(80) NOT NULL,
  `dealId` INT NULL,
  `providerRef` VARCHAR(120) NULL,
  `payload` JSON NOT NULL,
  `status` ENUM('RECEIVED', 'PROCESSED', 'FAILED') NOT NULL DEFAULT 'RECEIVED',
  `processedAt` DATETIME(3) NULL,
  `failureCode` VARCHAR(120) NULL,
  `failureMessage` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `escrow_webhook_events_eventId_key`(`eventId`),
  INDEX `escrow_webhook_events_status_createdAt_idx`(`status`, `createdAt`),
  INDEX `escrow_webhook_events_dealId_idx`(`dealId`),
  INDEX `escrow_webhook_events_providerRef_idx`(`providerRef`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
