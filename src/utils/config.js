import { ShopifyClient } from '../shopify/client.js';

export function getStoreConfig(storeName) {
  const tokenKey = `${storeName.toUpperCase()}_STORE_TOKEN`;
  const urlKey = `${storeName.toUpperCase()}_STORE_URL`;

  const token = process.env[tokenKey];
  const storeUrl = process.env[urlKey];

  if (!token) {
    throw new Error(
      `Missing ${tokenKey} in environment variables. Please check your .env file.`
    );
  }

  return {
    token,
    storeUrl,
  };
}

export function createShopifyClient(storeName) {
  const { token, storeUrl } = getStoreConfig(storeName);

  // Extract store name from URL if provided, otherwise use storeName
  let actualStoreName = storeName;
  if (storeUrl) {
    const match = storeUrl.match(/^(?:https?:\/\/)?([^.]+)\.myshopify\.com/);
    if (match) {
      actualStoreName = match[1];
    } else if (storeUrl.includes('.')) {
      // Assume it's just the store name part
      actualStoreName = storeUrl.split('.')[0];
    } else {
      // Assume it's just the store name
      actualStoreName = storeUrl;
    }
  }

  return new ShopifyClient(token, actualStoreName);
}

export function validateStoreNames(stores) {
  const missing = [];

  for (const store of stores) {
    try {
      getStoreConfig(store);
    } catch (error) {
      missing.push(store);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing configuration for stores: ${missing.join(', ')}`);
  }
}
