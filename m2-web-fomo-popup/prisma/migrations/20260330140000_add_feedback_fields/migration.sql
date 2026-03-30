-- AlterTable: add feedback columns to uninstallfeedback
ALTER TABLE `uninstallfeedback`
  ADD COLUMN `feedbackText`        TEXT,
  ADD COLUMN `feedbackToken`       VARCHAR(128) UNIQUE,
  ADD COLUMN `feedbackSubmittedAt` DATETIME(3);
