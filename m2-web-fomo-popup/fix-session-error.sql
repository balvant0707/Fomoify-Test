-- Fix Session Error - Enable Theme Extension for your shop

-- Update the themeExtensionEnabled field to 1 (enabled) for your shop
UPDATE `Shop` 
SET `themeExtensionEnabled` = 1 
WHERE `shop` = 'testing-m2web.myshopify.com';

-- Verify the update
SELECT `id`, `shop`, `installed`, `themeExtensionEnabled` 
FROM `Shop` 
WHERE `shop` = 'testing-m2web.myshopify.com';
