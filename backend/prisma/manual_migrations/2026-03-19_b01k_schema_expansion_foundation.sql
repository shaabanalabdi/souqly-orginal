-- B-01k: Schema expansion foundation migration
-- Scope:
-- - Add operational tables introduced in schema.prisma that were missing from manual SQL migrations.
-- - Keep referential integrity and indexes aligned with Prisma model intent.

-- ═══════════════════════════════════════
-- NOTIFICATIONS
-- ═══════════════════════════════════════

CREATE TABLE `notifications` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `type` ENUM(
    'MESSAGE_RECEIVED',
    'OFFER_RECEIVED',
    'OFFER_RESPONDED',
    'PHONE_REQUESTED',
    'DEAL_CREATED',
    'DEAL_CONFIRMED',
    'DEAL_COMPLETED',
    'DEAL_CANCELLED',
    'DEAL_DISPUTED',
    'ESCROW_HELD',
    'ESCROW_RELEASED',
    'ESCROW_REFUNDED',
    'DISPUTE_OPENED',
    'DISPUTE_RESOLVED',
    'REVIEW_RECEIVED',
    'LISTING_APPROVED',
    'LISTING_REJECTED',
    'LISTING_FEATURED',
    'LISTING_SOLD',
    'VERIFICATION_APPROVED',
    'VERIFICATION_REJECTED',
    'SUBSCRIPTION_ACTIVATED',
    'SUBSCRIPTION_EXPIRED',
    'REPORT_RESOLVED',
    'SYSTEM'
  ) NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `body` TEXT NOT NULL,
  `targetType` VARCHAR(50) NULL,
  `targetId` INT NULL,
  `link` VARCHAR(500) NULL,
  `isRead` BOOLEAN NOT NULL DEFAULT FALSE,
  `readAt` DATETIME(3) NULL,
  `dedupKey` VARCHAR(120) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `notifications_dedupKey_key` (`dedupKey`),
  INDEX `notifications_userId_isRead_idx` (`userId`, `isRead`),
  INDEX `notifications_userId_createdAt_idx` (`userId`, `createdAt`),
  CONSTRAINT `notifications_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `notification_preferences` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `emailEnabled` BOOLEAN NOT NULL DEFAULT TRUE,
  `pushEnabled` BOOLEAN NOT NULL DEFAULT TRUE,
  `chatMessages` BOOLEAN NOT NULL DEFAULT TRUE,
  `offerUpdates` BOOLEAN NOT NULL DEFAULT TRUE,
  `dealUpdates` BOOLEAN NOT NULL DEFAULT TRUE,
  `systemAlerts` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `notification_preferences_userId_key` (`userId`),
  CONSTRAINT `notification_preferences_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ═══════════════════════════════════════
-- LISTING AUDIT TRAILS
-- ═══════════════════════════════════════

CREATE TABLE `listing_status_history` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `listingId` INT NOT NULL,
  `oldStatus` ENUM('PENDING', 'ACTIVE', 'REJECTED', 'SOLD', 'EXPIRED', 'DELETED') NOT NULL,
  `newStatus` ENUM('PENDING', 'ACTIVE', 'REJECTED', 'SOLD', 'EXPIRED', 'DELETED') NOT NULL,
  `actorId` INT NOT NULL,
  `reason` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `listing_status_history_listingId_idx` (`listingId`),
  INDEX `listing_status_history_actorId_idx` (`actorId`),
  CONSTRAINT `listing_status_history_listingId_fkey`
    FOREIGN KEY (`listingId`) REFERENCES `listings` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `listing_status_history_actorId_fkey`
    FOREIGN KEY (`actorId`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `listing_monthly_quota` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `yearMonth` VARCHAR(7) NOT NULL,
  `publishedCount` INT NOT NULL DEFAULT 0,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `listing_monthly_quota_userId_yearMonth_key` (`userId`, `yearMonth`),
  INDEX `listing_monthly_quota_userId_idx` (`userId`),
  CONSTRAINT `listing_monthly_quota_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ═══════════════════════════════════════
-- TRUST + ROLE AUDIT
-- ═══════════════════════════════════════

CREATE TABLE `trust_score_events` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `eventType` ENUM(
    'DEAL_COMPLETED',
    'REVIEW_RECEIVED',
    'EMAIL_VERIFIED',
    'PHONE_VERIFIED',
    'ID_VERIFIED',
    'DISPUTE_OPENED',
    'FRAUD_FLAGGED',
    'ACCOUNT_AGE_MILESTONE',
    'RECALCULATION'
  ) NOT NULL,
  `delta` INT NOT NULL,
  `scoreBefore` INT NOT NULL,
  `scoreAfter` INT NOT NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `trust_score_events_userId_createdAt_idx` (`userId`, `createdAt`),
  CONSTRAINT `trust_score_events_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `user_role_history` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `changedById` INT NOT NULL,
  `oldStaffRole` ENUM('NONE', 'MODERATOR', 'ADMIN') NOT NULL,
  `newStaffRole` ENUM('NONE', 'MODERATOR', 'ADMIN') NOT NULL,
  `oldAccountType` ENUM('INDIVIDUAL', 'STORE', 'CRAFTSMAN') NOT NULL,
  `newAccountType` ENUM('INDIVIDUAL', 'STORE', 'CRAFTSMAN') NOT NULL,
  `reason` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `user_role_history_userId_idx` (`userId`),
  INDEX `user_role_history_changedById_idx` (`changedById`),
  CONSTRAINT `user_role_history_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `user_role_history_changedById_fkey`
    FOREIGN KEY (`changedById`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ═══════════════════════════════════════
-- STORE ANALYTICS + FRAUD + LEADS
-- ═══════════════════════════════════════

CREATE TABLE `store_analytics_daily` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `date` DATE NOT NULL,
  `listingViews` INT NOT NULL DEFAULT 0,
  `profileViews` INT NOT NULL DEFAULT 0,
  `chatStarts` INT NOT NULL DEFAULT 0,
  `offersReceived` INT NOT NULL DEFAULT 0,
  `dealsCreated` INT NOT NULL DEFAULT 0,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `store_analytics_daily_userId_date_key` (`userId`, `date`),
  INDEX `store_analytics_daily_userId_idx` (`userId`),
  CONSTRAINT `store_analytics_daily_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `fraud_signals` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `listingId` INT NULL,
  `userId` INT NULL,
  `signalCode` VARCHAR(100) NOT NULL,
  `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL,
  `score` INT NOT NULL DEFAULT 0,
  `payload` JSON NULL,
  `resolvedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `fraud_signals_listingId_idx` (`listingId`),
  INDEX `fraud_signals_userId_idx` (`userId`),
  INDEX `fraud_signals_severity_createdAt_idx` (`severity`, `createdAt`),
  CONSTRAINT `fraud_signals_listingId_fkey`
    FOREIGN KEY (`listingId`) REFERENCES `listings` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fraud_signals_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `craftsman_leads` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `craftsmanUserId` INT NOT NULL,
  `fromUserId` INT NULL,
  `source` VARCHAR(50) NOT NULL,
  `message` TEXT NULL,
  `status` ENUM('NEW', 'CONTACTED', 'CLOSED', 'SPAM') NOT NULL DEFAULT 'NEW',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `craftsman_leads_craftsmanUserId_idx` (`craftsmanUserId`),
  INDEX `craftsman_leads_status_idx` (`status`),
  CONSTRAINT `craftsman_leads_craftsmanUserId_fkey`
    FOREIGN KEY (`craftsmanUserId`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `craftsman_leads_fromUserId_fkey`
    FOREIGN KEY (`fromUserId`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ═══════════════════════════════════════
-- SYSTEM CONFIG VERSIONING
-- ═══════════════════════════════════════

CREATE TABLE `system_config_versions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `version` INT NOT NULL DEFAULT 0,
  `configJson` JSON NOT NULL,
  `changedById` INT NOT NULL,
  `changeNote` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `system_config_versions_version_idx` (`version`),
  CONSTRAINT `system_config_versions_changedById_fkey`
    FOREIGN KEY (`changedById`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
