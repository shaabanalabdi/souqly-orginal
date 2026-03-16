-- B-01f manual migration: Hybrid role model (accountType + staffRole)
-- Date: 2026-03-12

ALTER TABLE `users`
  ADD COLUMN `accountType` ENUM('INDIVIDUAL','STORE','CRAFTSMAN') NOT NULL DEFAULT 'INDIVIDUAL' AFTER `role`,
  ADD COLUMN `staffRole` ENUM('NONE','MODERATOR','ADMIN') NOT NULL DEFAULT 'NONE' AFTER `accountType`;

CREATE INDEX `users_accountType_idx` ON `users` (`accountType`);
CREATE INDEX `users_staffRole_idx` ON `users` (`staffRole`);

CREATE TABLE IF NOT EXISTS `craftsman_profiles` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `profession` VARCHAR(120) NOT NULL,
  `experienceYears` INT NULL,
  `workingHours` VARCHAR(255) NULL,
  `workingAreas` JSON NULL,
  `portfolio` JSON NULL,
  `availableNow` BOOLEAN NOT NULL DEFAULT false,
  `verifiedByAdmin` BOOLEAN NOT NULL DEFAULT false,
  `verifiedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `craftsman_profiles_userId_key` (`userId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `craftsman_profiles_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
);

-- 1) Migrate moderation permissions from legacy role to staffRole.
UPDATE `users`
SET `staffRole` = CASE
  WHEN `role` = 'ADMIN' THEN 'ADMIN'
  WHEN `role` = 'MODERATOR' THEN 'MODERATOR'
  ELSE 'NONE'
END;

-- 2) Infer account type from profile tables.
UPDATE `users` u
LEFT JOIN `business_profiles` bp ON bp.`userId` = u.`id`
LEFT JOIN `craftsman_profiles` cp ON cp.`userId` = u.`id`
SET u.`accountType` = CASE
  WHEN cp.`id` IS NOT NULL THEN 'CRAFTSMAN'
  WHEN bp.`id` IS NOT NULL THEN 'STORE'
  ELSE 'INDIVIDUAL'
END;

-- 3) Keep legacy role synchronized for backward compatibility.
UPDATE `users`
SET `role` = CASE
  WHEN `staffRole` = 'ADMIN' THEN 'ADMIN'
  WHEN `staffRole` = 'MODERATOR' THEN 'MODERATOR'
  ELSE 'USER'
END;
