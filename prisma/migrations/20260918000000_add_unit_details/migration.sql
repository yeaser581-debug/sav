-- Unit details carried over from the developer's spreadsheet.
ALTER TABLE `Client`
  ADD COLUMN `unitCode` VARCHAR(191) NULL,
  ADD COLUMN `floor` VARCHAR(191) NULL,
  ADD COLUMN `unitType` VARCHAR(191) NULL,
  ADD COLUMN `standing` VARCHAR(191) NULL,
  ADD COLUMN `addressLine` VARCHAR(191) NULL,
  ADD COLUMN `city` VARCHAR(191) NULL,
  ADD COLUMN `country` VARCHAR(191) NULL,
  ADD COLUMN `phone2` VARCHAR(191) NULL;

-- The unit code identifies a row across re-imports, so it must stay unique.
CREATE UNIQUE INDEX `Client_unitCode_key` ON `Client`(`unitCode`);

ALTER TABLE `Building` ADD COLUMN `tranche` VARCHAR(191) NULL;
