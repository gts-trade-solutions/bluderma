-- Store a treatment-owned comparison pair instead of sharing category cases.
ALTER TABLE `hub_treatments`
  ADD COLUMN `beforeImage` TEXT NULL,
  ADD COLUMN `afterImage` TEXT NULL;
