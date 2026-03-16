-- B-01i: Identity verification workflow foundation
-- Safe migration notes:
-- 1) Add user-level verification status columns with non-breaking defaults.
-- 2) Create identity_verification_requests table for request/review lifecycle.

ALTER TABLE `users`
  ADD COLUMN `identityVerificationStatus` ENUM('NONE', 'PENDING', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'NONE' AFTER `staffRole`,
  ADD COLUMN `identityVerifiedAt` DATETIME(3) NULL AFTER `identityVerificationStatus`;

CREATE INDEX `users_identityVerificationStatus_idx` ON `users`(`identityVerificationStatus`);

CREATE TABLE `identity_verification_requests` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `status` ENUM('NONE', 'PENDING', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `documentType` VARCHAR(50) NOT NULL,
  `documentNumberMasked` VARCHAR(50) NULL,
  `documentFrontUrl` VARCHAR(500) NULL,
  `documentBackUrl` VARCHAR(500) NULL,
  `selfieUrl` VARCHAR(500) NULL,
  `note` TEXT NULL,
  `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reviewedAt` DATETIME(3) NULL,
  `reviewerId` INT NULL,
  `reviewerNote` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `identity_verification_requests_userId_status_idx`(`userId`, `status`),
  INDEX `identity_verification_requests_status_submittedAt_idx`(`status`, `submittedAt`),
  INDEX `identity_verification_requests_reviewerId_idx`(`reviewerId`),

  CONSTRAINT `identity_verification_requests_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `identity_verification_requests_reviewerId_fkey`
    FOREIGN KEY (`reviewerId`) REFERENCES `users`(`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
