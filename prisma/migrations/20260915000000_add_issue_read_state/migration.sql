-- AlterTable
ALTER TABLE `Issue` ADD COLUMN `adminLastReadAt` DATETIME(3) NULL,
    ADD COLUMN `clientLastReadAt` DATETIME(3) NULL;

-- Backfill only what the data can vouch for.
-- A claim the administration visibly acted on counts as read by it, dated at
-- its last admin message, or its last update when it has none. Untouched
-- pending claims stay unread so they surface in the inbox.
-- clientLastReadAt stays NULL: nothing records whether a resident ever opened
-- a claim, so past admin messages must not be shown as seen.
UPDATE `Issue` i
SET i.`adminLastReadAt` = COALESCE(
  (SELECT MAX(m.`createdAt`) FROM `IssueMessage` m WHERE m.`issueId` = i.`id` AND m.`senderType` = 'ADMIN'),
  i.`updatedAt`
)
WHERE i.`status` <> 'PENDING_AGENT'
   OR i.`agentId` IS NOT NULL
   OR EXISTS (
     SELECT 1 FROM `IssueMessage` m2
     WHERE m2.`issueId` = i.`id` AND m2.`senderType` = 'ADMIN'
   );
