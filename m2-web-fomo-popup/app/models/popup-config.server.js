import prisma from "../db.server";

const toStr = (v) => {
  const s = v === undefined || v === null ? "" : String(v).trim();
  return s === "" ? null : s;
};
const toInt = (v) => {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : null;
};
const toBool = (v, fallback = false) => {
  if (v === undefined) return fallback;
  return !!v;
};
const toJson = (v) => JSON.stringify(Array.isArray(v) ? v : []);
const stripUndefined = (data) => {
  Object.keys(data).forEach((k) => {
    if (data[k] === undefined) delete data[k];
  });
  return data;
};
const SPLIT_SELECTION_COLUMNS = [
  "selectedDataProductsJson",
  "selectedVisibilityProductsJson",
];
const ADD_TO_CART_EXTRA_COLUMNS = [
  "avgTime",
  "avgUnit",
  "customerInfo",
  "imageAppearance",
];
const MAX_SCHEMA_FALLBACK_ATTEMPTS = 30;
const withoutKeys = (obj, keys) => {
  const out = { ...obj };
  for (const key of keys) delete out[key];
  return out;
};
const normalizeColumnName = (value) => {
  const raw = String(value || "")
    .replace(/[`'"]/g, "")
    .trim();
  if (!raw) return "";
  const parts = raw.split(".");
  return parts[parts.length - 1] || "";
};
const extractMissingColumn = (err) => {
  const fromMeta = normalizeColumnName(err?.meta?.column);
  if (fromMeta) return fromMeta;

  const msg = String(err?.message || "");
  const patterns = [
    /unknown column ['`"]([^'`"]+)['`"]/i,
    /the column ['`"]([^'`"]+)['`"] does not exist/i,
    /column ['`"]([^'`"]+)['`"] does not exist/i,
  ];

  for (const pattern of patterns) {
    const match = msg.match(pattern);
    if (match?.[1]) return normalizeColumnName(match[1]);
  }
  return "";
};
const hasMissingColumnError = (err) => {
  const code = String(err?.code || "").toUpperCase();
  const msg = String(err?.message || "").toLowerCase();

  if (code === "P2022") return true;
  if (msg.includes("unknown column")) return true;
  return msg.includes("column") && msg.includes("does not exist");
};

async function upsertByShop(
  table,
  shop,
  data,
  modelName = "unknown",
  preferredId = null
) {
  const payload = stripUndefined({ ...data, shop });
  try {
    console.log("[PopupConfig] upsert start:", {
      model: modelName,
      shop,
      payload: payload,
    });

    const parsedPreferredId = Number(preferredId);
    const hasPreferredId =
      Number.isInteger(parsedPreferredId) && parsedPreferredId > 0;

    let existing = null;
    if (hasPreferredId) {
      existing = await table.findFirst({
        where: { id: parsedPreferredId, shop },
        select: { id: true },
      });
    }

    if (!existing) {
      existing = await table.findFirst({
        where: { shop },
        orderBy: { id: "desc" },
        select: { id: true },
      });
    }

    if (existing?.id) {
      const updated = await table.update({
        where: { id: existing.id },
        data: payload,
        select: { id: true },
      });
      try {
        await table.deleteMany({
          where: { shop, id: { not: existing.id } },
        });
      } catch (cleanupError) {
        console.warn("[PopupConfig] singleton cleanup failed:", {
          model: modelName,
          shop,
          keepId: existing.id,
          error: cleanupError?.message || cleanupError,
        });
      }
      console.log("[PopupConfig] update result:", {
        model: modelName,
        shop,
        updatedCount: updated?.id ? 1 : 0,
        id: existing.id,
      });
      return updated;
    }

    const created = await table.create({
      data: payload,
      select: { id: true },
    });
    try {
      if (created?.id) {
        await table.deleteMany({
          where: { shop, id: { not: created.id } },
        });
      }
    } catch (cleanupError) {
      console.warn("[PopupConfig] singleton cleanup failed:", {
        model: modelName,
        shop,
        keepId: created?.id ?? null,
        error: cleanupError?.message || cleanupError,
      });
    }
    console.log("[PopupConfig] create result:", {
      model: modelName,
      shop,
      id: created?.id ?? null,
    });
    return created;
  } catch (e) {
    console.error("[PopupConfig] upsert failed:", {
      model: modelName,
      shop,
      error: e?.message || e,
      code: e?.code || null,
    });
    throw e;
  }
}

async function upsertByShopWithSplitFallback(
  table,
  shop,
  data,
  modelName = "unknown",
  fallbackColumns = SPLIT_SELECTION_COLUMNS,
  preferredId = null
) {
  let workingData = { ...data };
  const removable = new Set();
  const preferredRemovals = Array.isArray(fallbackColumns) ? [...fallbackColumns] : [];

  for (let attempt = 0; attempt < MAX_SCHEMA_FALLBACK_ATTEMPTS; attempt += 1) {
    try {
      const suffix = attempt === 0 ? "" : `:fallback${attempt}`;
      return await upsertByShop(
        table,
        shop,
        workingData,
        `${modelName}${suffix}`,
        preferredId
      );
    } catch (e) {
      if (!hasMissingColumnError(e)) throw e;

      const discovered = extractMissingColumn(e);
      if (discovered) {
        removable.add(discovered);
      } else {
        let candidate = null;
        for (const column of preferredRemovals) {
          if (removable.has(column)) continue;
          if (!Object.prototype.hasOwnProperty.call(workingData, column)) continue;
          candidate = column;
          break;
        }
        if (!candidate) throw e;
        removable.add(candidate);
      }

      const nextData = withoutKeys(workingData, [...removable]);
      const unchanged =
        Object.keys(nextData).length === Object.keys(workingData).length;
      if (unchanged) throw e;

      console.warn("[PopupConfig] columns missing; retrying legacy payload:", {
        model: modelName,
        shop,
        discoveredColumn: discovered || null,
        removedColumns: [...removable],
      });
      workingData = nextData;
    }
  }

  return upsertByShop(
    table,
    shop,
    workingData,
    `${modelName}:fallback-final`,
    preferredId
  );
}

export async function saveVisitorPopup(shop, form) {
  const table =
    prisma?.visitorpopupconfig || prisma?.visitorPopupConfig || null;
  if (!table) {
    throw new Error("Prisma model missing: visitorpopupconfig");
  }

  const selectedDataProducts = Array.isArray(form?.selectedDataProducts)
    ? form.selectedDataProducts
    : Array.isArray(form?.selectedProducts)
      ? form.selectedProducts
      : [];
  const selectedVisibilityProducts = Array.isArray(form?.selectedVisibilityProducts)
    ? form.selectedVisibilityProducts
    : selectedDataProducts;

  const data = {
    enabled: toBool(form?.enabled, true),

    notiType: toStr(form?.design?.notiType),
    layout: toStr(form?.design?.layout),
    size: toInt(form?.design?.size),
    transparent: toInt(form?.design?.transparent),
    template: toStr(form?.design?.template),
    imageAppearance: toStr(form?.design?.imageAppearance || "contain"),
    bgColor: toStr(form?.design?.bgColor),
    bgAlt: toStr(form?.design?.bgAlt),
    textColor: toStr(form?.design?.textColor),
    timestampColor: toStr(form?.design?.timestampColor),
    priceTagBg: toStr(form?.design?.priceTagBg),
    priceTagAlt: toStr(form?.design?.priceTagAlt),
    priceColor: toStr(form?.design?.priceColor),
    starColor: toStr(form?.design?.starColor),

    textSizeContent: toInt(form?.textSize?.content),
    textSizeCompareAt: toInt(form?.textSize?.compareAt),
    textSizePrice: toInt(form?.textSize?.price),

    message: toStr(form?.content?.message),
    timestamp: toStr(form?.content?.timestamp),
    avgTime: toStr(form?.content?.avgTime),
    avgUnit: toStr(form?.content?.avgUnit),

    productNameMode: toStr(form?.productNameMode),
    productNameLimit: toInt(form?.productNameLimit),

    directProductPage: toBool(form?.data?.directProductPage),
    showProductImage: toBool(form?.data?.showProductImage),
    showPriceTag: toBool(form?.data?.showPriceTag),
    showRating: toBool(form?.data?.showRating),
    ratingSource: toStr(form?.data?.ratingSource),
    customerInfo: toStr(form?.data?.customerInfo),

    showHome: toBool(form?.visibility?.showHome),
    showProduct: toBool(form?.visibility?.showProduct),
    productScope: toStr(form?.visibility?.productScope),
    showCollectionList: toBool(form?.visibility?.showCollectionList),
    showCollection: toBool(form?.visibility?.showCollection),
    collectionScope: toStr(form?.visibility?.collectionScope),
    showCart: toBool(form?.visibility?.showCart),
    position: toStr(form?.visibility?.position),

    showClose: toBool(form?.behavior?.showClose),
    hideOnMobile: toBool(form?.behavior?.hideOnMobile),
    delay: toInt(form?.behavior?.delay),
    duration: toInt(form?.behavior?.duration),
    interval: toInt(form?.behavior?.interval),
    intervalUnit: toStr(form?.behavior?.intervalUnit),
    randomize: toBool(form?.behavior?.randomize),

    selectedDataProductsJson: toJson(selectedDataProducts),
    selectedVisibilityProductsJson: toJson(selectedVisibilityProducts),
    // Keep legacy field populated for backward compatibility.
    selectedProductsJson: toJson(selectedDataProducts),
    selectedCollectionsJson: toJson(form?.selectedCollections),
  };

  return upsertByShopWithSplitFallback(table, shop, data, "visitorpopupconfig");
}

export async function saveLowStockPopup(shop, form) {
  const table =
    prisma?.lowstockpopupconfig || prisma?.lowStockPopupConfig || null;
  if (!table) {
    throw new Error("Prisma model missing: lowstockpopupconfig");
  }

  const selectedDataProducts = Array.isArray(form?.selectedDataProducts)
    ? form.selectedDataProducts
    : Array.isArray(form?.selectedProducts)
      ? form.selectedProducts
      : [];
  const selectedVisibilityProducts = Array.isArray(form?.selectedVisibilityProducts)
    ? form.selectedVisibilityProducts
    : selectedDataProducts;

  const data = {
    enabled: toBool(form?.enabled, true),

    layout: toStr(form?.design?.layout),
    size: toInt(form?.design?.size),
    transparent: toInt(form?.design?.transparent),
    template: toStr(form?.design?.template),
    imageAppearance: toStr(form?.design?.imageAppearance),
    bgColor: toStr(form?.design?.bgColor),
    bgAlt: toStr(form?.design?.bgAlt),
    textColor: toStr(form?.design?.textColor),
    numberColor: toStr(form?.design?.numberColor),
    priceTagBg: toStr(form?.design?.priceTagBg),
    priceTagAlt: toStr(form?.design?.priceTagAlt),
    priceColor: toStr(form?.design?.priceColor),
    starColor: toStr(form?.design?.starColor),

    textSizeContent: toInt(form?.textSize?.content),
    textSizeCompareAt: toInt(form?.textSize?.compareAt),
    textSizePrice: toInt(form?.textSize?.price),

    message: toStr(form?.content?.message),
    productNameMode: toStr(form?.productNameMode),
    productNameLimit: toInt(form?.productNameLimit),

    dataSource: toStr(form?.data?.dataSource),
    stockUnder: toInt(form?.data?.stockUnder),
    hideOutOfStock: toBool(form?.data?.hideOutOfStock),
    directProductPage: toBool(form?.data?.directProductPage),
    showProductImage: toBool(form?.data?.showProductImage),
    showPriceTag: toBool(form?.data?.showPriceTag),
    showRating: toBool(form?.data?.showRating),

    showHome: toBool(form?.visibility?.showHome),
    showProduct: toBool(form?.visibility?.showProduct),
    productScope: toStr(form?.visibility?.productScope),
    showCollectionList: toBool(form?.visibility?.showCollectionList),
    showCollection: toBool(form?.visibility?.showCollection),
    collectionScope: toStr(form?.visibility?.collectionScope),
    showCart: toBool(form?.visibility?.showCart),
    position: toStr(form?.visibility?.position),

    showClose: toBool(form?.behavior?.showClose),
    hideOnMobile: toBool(form?.behavior?.hideOnMobile),
    delay: toInt(form?.behavior?.delay),
    duration: toInt(form?.behavior?.duration),
    interval: toInt(form?.behavior?.interval),
    intervalUnit: toStr(form?.behavior?.intervalUnit),
    randomize: toBool(form?.behavior?.randomize),

    selectedDataProductsJson: toJson(selectedDataProducts),
    selectedVisibilityProductsJson: toJson(selectedVisibilityProducts),
    // Keep legacy field populated for backward compatibility.
    selectedProductsJson: toJson(selectedDataProducts),
    selectedCollectionsJson: toJson(form?.selectedCollections),
  };

  return upsertByShopWithSplitFallback(
    table,
    shop,
    data,
    "lowstockpopupconfig"
  );
}

export async function saveAddToCartPopup(shop, form) {
  const table =
    prisma?.addtocartpopupconfig || prisma?.addToCartPopupConfig || null;
  if (!table) {
    throw new Error("Prisma model missing: addtocartpopupconfig");
  }

  const selectedDataProducts = Array.isArray(form?.selectedDataProducts)
    ? form.selectedDataProducts
    : Array.isArray(form?.selectedProducts)
      ? form.selectedProducts
      : [];
  const selectedVisibilityProducts = Array.isArray(form?.selectedVisibilityProducts)
    ? form.selectedVisibilityProducts
    : selectedDataProducts;

  const data = {
    enabled: toBool(form?.enabled, true),

    layout: toStr(form?.design?.layout),
    size: toInt(form?.design?.size),
    transparent: toInt(form?.design?.transparent),
    template: toStr(form?.design?.template),
    imageAppearance: toStr(form?.design?.imageAppearance),
    bgColor: toStr(form?.design?.bgColor),
    bgAlt: toStr(form?.design?.bgAlt),
    textColor: toStr(form?.design?.textColor),
    timestampColor: toStr(form?.design?.timestampColor),
    priceTagBg: toStr(form?.design?.priceTagBg),
    priceTagAlt: toStr(form?.design?.priceTagAlt),
    priceColor: toStr(form?.design?.priceColor),
    starColor: toStr(form?.design?.starColor),

    textSizeContent: toInt(form?.textSize?.content),
    textSizeCompareAt: toInt(form?.textSize?.compareAt),
    textSizePrice: toInt(form?.textSize?.price),

    message: toStr(form?.content?.message),
    timestamp: toStr(form?.content?.timestamp),
    avgTime: toStr(form?.content?.avgTime),
    avgUnit: toStr(form?.content?.avgUnit),
    productNameMode: toStr(form?.productNameMode),
    productNameLimit: toInt(form?.productNameLimit),

    dataSource: toStr(form?.data?.dataSource),
    customerInfo: toStr(form?.data?.customerInfo),
    stockUnder: toInt(form?.data?.stockUnder),
    hideOutOfStock: toBool(form?.data?.hideOutOfStock),
    directProductPage: toBool(form?.data?.directProductPage),
    showProductImage: toBool(form?.data?.showProductImage),
    showPriceTag: toBool(form?.data?.showPriceTag),
    showRating: toBool(form?.data?.showRating),

    showHome: toBool(form?.visibility?.showHome),
    showProduct: toBool(form?.visibility?.showProduct),
    productScope: toStr(form?.visibility?.productScope),
    showCollectionList: toBool(form?.visibility?.showCollectionList),
    showCollection: toBool(form?.visibility?.showCollection),
    collectionScope: toStr(form?.visibility?.collectionScope),
    showCart: toBool(form?.visibility?.showCart),
    position: toStr(form?.visibility?.position),

    showClose: toBool(form?.behavior?.showClose),
    hideOnMobile: toBool(form?.behavior?.hideOnMobile),
    delay: toInt(form?.behavior?.delay),
    duration: toInt(form?.behavior?.duration),
    interval: toInt(form?.behavior?.interval),
    intervalUnit: toStr(form?.behavior?.intervalUnit),
    randomize: toBool(form?.behavior?.randomize),

    selectedDataProductsJson: toJson(selectedDataProducts),
    selectedVisibilityProductsJson: toJson(selectedVisibilityProducts),
    // Keep legacy field populated for backward compatibility.
    selectedProductsJson: toJson(selectedDataProducts),
    selectedCollectionsJson: toJson(form?.selectedCollections),
  };
  const preferredId = toInt(form?.editId ?? form?.id);

  return upsertByShopWithSplitFallback(
    table,
    shop,
    data,
    "addtocartpopupconfig",
    [...SPLIT_SELECTION_COLUMNS, ...ADD_TO_CART_EXTRA_COLUMNS],
    preferredId
  );
}

export async function saveReviewPopup(shop, form) {
  const table =
    prisma?.reviewpopupconfig || prisma?.reviewPopupConfig || null;
  if (!table) {
    throw new Error("Prisma model missing: reviewpopupconfig");
  }

  const selectedDataProducts = Array.isArray(form?.selectedDataProducts)
    ? form.selectedDataProducts
    : Array.isArray(form?.selectedProducts)
      ? form.selectedProducts
      : [];
  const selectedVisibilityProducts = Array.isArray(form?.selectedVisibilityProducts)
    ? form.selectedVisibilityProducts
    : selectedDataProducts;

  const data = {
    enabled: toBool(form?.enabled, true),

    reviewType: toStr(form?.design?.reviewType),
    template: toStr(form?.design?.template),
    imageAppearance: toStr(form?.design?.imageAppearance),
    bgColor: toStr(form?.design?.bgColor),
    bgAlt: toStr(form?.design?.bgAlt),
    textColor: toStr(form?.design?.textColor),
    timestampColor: toStr(form?.design?.timestampColor),
    priceTagBg: toStr(form?.design?.priceTagBg),
    priceTagAlt: toStr(form?.design?.priceTagAlt),
    priceColor: toStr(form?.design?.priceColor),
    starColor: toStr(form?.design?.starColor),

    textSizeContent: toInt(form?.textSize?.content),
    textSizeCompareAt: toInt(form?.textSize?.compareAt),
    textSizePrice: toInt(form?.textSize?.price),

    message: toStr(form?.content?.message),
    timestamp: toStr(form?.content?.timestamp),
    productNameMode: toStr(form?.productNameMode),
    productNameLimit: toInt(form?.productNameLimit),

    dataSource: toStr(form?.data?.dataSource),
    directProductPage: toBool(form?.data?.directProductPage),
    showProductImage: toBool(form?.data?.showProductImage),
    showPriceTag: toBool(form?.data?.showPriceTag),
    showRating: toBool(form?.data?.showRating),

    showHome: toBool(form?.visibility?.showHome),
    showProduct: toBool(form?.visibility?.showProduct),
    productScope: toStr(form?.visibility?.productScope),
    showCollectionList: toBool(form?.visibility?.showCollectionList),
    showCollection: toBool(form?.visibility?.showCollection),
    collectionScope: toStr(form?.visibility?.collectionScope),
    showCart: toBool(form?.visibility?.showCart),
    position: toStr(form?.visibility?.position),

    showClose: toBool(form?.behavior?.showClose),
    hideOnMobile: toBool(form?.behavior?.hideOnMobile),
    delay: toInt(form?.behavior?.delay),
    duration: toInt(form?.behavior?.duration),
    interval: toInt(form?.behavior?.interval),
    intervalUnit: toStr(form?.behavior?.intervalUnit),
    randomize: toBool(form?.behavior?.randomize),

    selectedDataProductsJson: toJson(selectedDataProducts),
    selectedVisibilityProductsJson: toJson(selectedVisibilityProducts),
    // Keep legacy field populated for backward compatibility.
    selectedProductsJson: toJson(selectedDataProducts),
    selectedCollectionsJson: toJson(form?.selectedCollections),
  };
  const preferredId = toInt(form?.editId ?? form?.id);

  return upsertByShopWithSplitFallback(
    table,
    shop,
    data,
    "reviewpopupconfig",
    SPLIT_SELECTION_COLUMNS,
    preferredId
  );
}

export async function saveRecentPopup(shop, form) {
  const table =
    prisma?.recentpopupconfig || prisma?.recentPopupConfig || null;
  if (!table) {
    throw new Error("Prisma model missing: recentpopupconfig");
  }

  const data = {
    enabled: form?.enabled?.includes?.("enabled") ?? false,
    showType: toStr(form?.showType),
    messageText: toStr(form?.messageText),
    fontFamily: toStr(form?.fontFamily),
    position: toStr(form?.position),
    animation: toStr(form?.animation),
    mobileSize: toStr(form?.mobileSize),
    mobilePositionJson: JSON.stringify(form?.mobilePosition ?? []),

    template: toStr(form?.template),
    layout: toStr(form?.layout),
    imageAppearance: toStr(form?.imageAppearance),

    bgColor: toStr(form?.bgColor),
    bgAlt: toStr(form?.bgAlt),
    textColor: toStr(form?.textColor),
    numberColor: toStr(form?.numberColor),
    priceTagBg: toStr(form?.priceTagBg),
    priceTagAlt: toStr(form?.priceTagAlt),
    priceColor: toStr(form?.priceColor),
    starColor: toStr(form?.starColor),

    rounded: toInt(form?.rounded),
    firstDelaySeconds: toInt(form?.firstDelaySeconds),
    durationSeconds: toInt(form?.durationSeconds),
    alternateSeconds: toInt(form?.alternateSeconds),
    intervalUnit: toStr(form?.intervalUnit),
    fontWeight: toInt(form?.fontWeight),

    productNameMode: toStr(form?.productNameMode),
    productNameLimit: toInt(form?.productNameLimit),
    orderDays: toInt(form?.orderDays),
    createOrderTime: form?.createOrderTime ?? null,

    messageTitlesJson: JSON.stringify(form?.messageTitlesJson ?? []),
    locationsJson: JSON.stringify(form?.locationsJson ?? []),
    namesJson: JSON.stringify(form?.namesJson ?? []),
    selectedProductsJson: JSON.stringify(form?.selectedProductsJson ?? []),
  };
  const preferredId = toInt(form?.editId ?? form?.id);

  return upsertByShop(table, shop, data, "recentpopupconfig", preferredId);
}

export async function saveFlashPopup(shop, form) {
  const data = {
    enabled: form?.enabled?.includes?.("enabled") ?? false,
    showType: toStr(form?.showType),

    messageTitle: toStr(form?.messageTitle),
    name: toStr(form?.name),
    messageText: toStr(form?.messageText),

    fontFamily: toStr(form?.fontFamily),
    fontWeight: toInt(form?.fontWeight),
    layout: toStr(form?.layout),
    imageAppearance: toStr(form?.imageAppearance),
    template: toStr(form?.template),
    position: toStr(form?.position),
    animation: toStr(form?.animation),
    mobileSize: toStr(form?.mobileSize),
    mobilePositionJson: JSON.stringify(form?.mobilePosition ?? []),

    bgColor: toStr(form?.bgColor),
    bgAlt: toStr(form?.bgAlt),
    textColor: toStr(form?.textColor),
    numberColor: toStr(form?.numberColor),
    priceTagBg: toStr(form?.priceTagBg),
    priceTagAlt: toStr(form?.priceTagAlt),
    priceColor: toStr(form?.priceColor),
    starColor: toStr(form?.starColor),

    rounded: toInt(form?.rounded),
    firstDelaySeconds: toInt(form?.firstDelaySeconds),
    durationSeconds: toInt(form?.durationSeconds),
    alternateSeconds: toInt(form?.alternateSeconds),
    intervalUnit: toStr(form?.intervalUnit),

    iconKey: toStr(form?.iconKey),
    iconSvg: toStr(form?.iconSvg),

    messageTitlesJson: JSON.stringify(form?.messageTitlesJson ?? []),
    locationsJson: JSON.stringify(form?.locationsJson ?? []),
    namesJson: JSON.stringify(form?.namesJson ?? []),
    selectedProductsJson: JSON.stringify(form?.selectedProductsJson ?? []),
  };

  return upsertByShop(prisma.flashpopupconfig, shop, data, "flashpopupconfig");
}
