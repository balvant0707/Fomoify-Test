-- Multi-store session check helper.
-- Replace the value below with the shop you are testing.
-- Do not keep this fixed to testing-m2web.myshopify.com.

SET @shop := 'your-shop.myshopify.com';

-- Current app schema uses the lowercase `shop` table and does not require a
-- manual themeExtensionEnabled flag. A store works when it has an installed
-- shop row with an access token, created by Shopify OAuth.
SELECT
  `id`,
  `shop`,
  `installed`,
  `status`,
  `accessToken` IS NOT NULL AS `hasAccessToken`,
  `createdAt`,
  `updatedAt`
FROM `shop`
WHERE `shop` = @shop;

-- The permanent offline session should also exist for each installed store.
SELECT
  `id`,
  `shop`,
  `isOnline`,
  `accessToken` IS NOT NULL AS `hasAccessToken`,
  `expires`
FROM `session`
WHERE `id` = CONCAT('offline_', @shop) OR `shop` = @shop;
