-- Where a clinic is, as a country.
--
-- Additive with a default, so every existing row is correct the moment it
-- lands: each clinic listed when this ran was Indian, and the directory's new
-- Domestic tab reads this column. A nullable column would have put all of
-- them in neither tab.
ALTER TABLE `clinics` ADD COLUMN `country` VARCHAR(191) NOT NULL DEFAULT 'India';

CREATE INDEX `clinics_country_city_idx` ON `clinics`(`country`, `city`);
