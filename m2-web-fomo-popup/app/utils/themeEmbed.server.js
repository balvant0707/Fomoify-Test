import { getOrSetCache } from "./serverCache.server";
import { APP_EMBED_HANDLE } from "./themeEmbed.shared";

export const THEME_SETTINGS_DATA_KEY = "config/settings_data.json";
export { APP_EMBED_HANDLE };

const toLower = (value) => String(value || "").trim().toLowerCase();
const normalizeToken = (value) => toLower(value).replace(/[^a-z0-9]/g, "");
const toBool = (value) => {
  if (value === true || value === 1) return true;
  const v = toLower(value);
  return v === "true" || v === "1" || v === "yes" || v === "on";
};
const toNumericThemeId = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/\d+/);
  return match?.[0] || "";
};
const toThemeGid = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("gid://")) return raw;
  const id = toNumericThemeId(raw);
  return id ? `gid://shopify/OnlineStoreTheme/${id}` : "";
};
const isObjectRecord = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const collectThemeBlockMaps = (parsed) => {
  const maps = [];
  const pushBlocks = (value) => {
    if (isObjectRecord(value)) maps.push(value);
  };

  pushBlocks(parsed?.current?.blocks);
  pushBlocks(parsed?.blocks);

  if (typeof parsed?.current === "string") {
    pushBlocks(parsed?.presets?.[parsed.current]?.blocks);
  }

  if (isObjectRecord(parsed?.presets)) {
    Object.values(parsed.presets).forEach((preset) => {
      pushBlocks(preset?.blocks);
    });
  }

  const unique = [];
  const seen = new Set();
  maps.forEach((map) => {
    if (seen.has(map)) return;
    seen.add(map);
    unique.push(map);
  });
  return unique;
};
const collectThemeBlockEntries = (parsed) => {
  const entries = [];
  const seenBlocks = new Set();
  const pushEntry = (blockId, block) => {
    if (!isObjectRecord(block) || seenBlocks.has(block)) return;
    seenBlocks.add(block);
    entries.push({ blockId: String(blockId || ""), block });
  };

  collectThemeBlockMaps(parsed).forEach((blocks) => {
    Object.entries(blocks).forEach(([blockId, block]) => {
      pushEntry(blockId, block);
    });
  });

  const walk = (value, keyHint = "") => {
    if (Array.isArray(value)) {
      value.forEach((item, idx) =>
        walk(item, keyHint ? `${keyHint}:${idx}` : String(idx))
      );
      return;
    }
    if (!isObjectRecord(value)) return;
    if (typeof value.type === "string") {
      pushEntry(keyHint || value?.id || value?.type || "", value);
    }
    Object.entries(value).forEach(([key, child]) => walk(child, key));
  };

  walk(parsed);
  return entries;
};
// Returns ONLY the root-level blocks from the active (current) configuration.
// App embed blocks live exclusively at this level — NOT inside sections or presets.
// Using collectThemeBlockEntries (which deep-walks presets/sections) causes false
// positives: a preset copy with disabled:false makes the embed appear ON even
// when the current config has disabled:true.
const getActiveRootBlockEntries = (parsed) => {
  let blocks = null;
  if (typeof parsed?.current === "string") {
    // Old theme format: "current" is a preset name string
    blocks = parsed?.presets?.[parsed.current]?.blocks ?? null;
  } else if (isObjectRecord(parsed?.current)) {
    // Modern 2.0 theme format: "current" is the active configuration object
    blocks = parsed?.current?.blocks ?? null;
  }
  // Fallback for non-standard layouts
  if (!isObjectRecord(blocks)) blocks = parsed?.blocks ?? null;
  if (!isObjectRecord(blocks)) return [];
  return Object.entries(blocks)
    .filter(([, block]) => isObjectRecord(block))
    .map(([blockId, block]) => ({ blockId: String(blockId), block }));
};

const hasRestAssetResources = (admin) =>
  Boolean(admin?.rest?.resources?.Asset?.all);
const hasRestThemeResources = (admin) =>
  Boolean(admin?.rest?.resources?.Theme?.all);
const hasRestGet = (admin) => Boolean(admin?.rest?.get);
const hasGraphql = (admin) => typeof admin?.graphql === "function";
const graphqlJson = async (admin, query, variables) => {
  const response = await admin.graphql(query, { variables });
  const payload = response?.json ? await response.json() : response;
  if (Array.isArray(payload?.errors) && payload.errors.length) {
    const message = payload.errors[0]?.message || "Shopify GraphQL request failed";
    throw new Error(message);
  }
  return payload;
};

async function fetchThemeSettingsData({ admin, themeId }) {
  const restThemeId = toNumericThemeId(themeId);
  const themeGid = toThemeGid(themeId);

  if (hasRestAssetResources(admin) && restThemeId) {
    const params = {
      session: admin.session,
      theme_id: restThemeId,
      asset: { key: THEME_SETTINGS_DATA_KEY },
    };

    try {
      const resp = await admin.rest.resources.Asset.all(params);
      const data = resp?.data;
      if (Array.isArray(data)) return data[0]?.value || "";
      if (data?.asset?.value) return data.asset.value;
      return data?.value || "";
    } catch (assetError) {
      if (!hasRestGet(admin)) throw assetError;
      const fallbackResp = await admin.rest.get({
        path: `themes/${restThemeId}/assets`,
        query: { "asset[key]": THEME_SETTINGS_DATA_KEY },
      });
      const body = fallbackResp?.body || fallbackResp?.data || {};
      return body?.asset?.value || "";
    }
  }

  if (hasGraphql(admin) && themeGid) {
    const query = `
      query ThemeSettingsData($id: ID!, $filename: String!) {
        theme(id: $id) {
          files(first: 1, filenames: [$filename]) {
            nodes {
              body {
                ... on OnlineStoreThemeFileBodyText {
                  content
                }
                ... on OnlineStoreThemeFileBodyBase64 {
                  contentBase64
                }
              }
            }
          }
        }
      }
    `;
    const payload = await graphqlJson(admin, query, {
      id: themeGid,
      filename: THEME_SETTINGS_DATA_KEY,
    });
    const body = payload?.data?.theme?.files?.nodes?.[0]?.body;
    if (typeof body?.content === "string") return body.content;
    if (typeof body?.contentBase64 === "string") {
      return Buffer.from(body.contentBase64, "base64").toString("utf8");
    }
    return "";
  }

  throw new Error("Theme settings fetch unavailable: no REST or GraphQL transport");
}

export async function getMainThemeId({ admin, shop }) {
  try {
    const cacheKey = `themes:main:${shop}`;
    const cached = await getOrSetCache(cacheKey, 60000, async () => {
      if (hasRestThemeResources(admin)) {
        const resp = await admin.rest.resources.Theme.all({
          session: admin.session,
          fields: "id,role",
        });
        const themes = resp?.data || [];
        const live = themes.find((t) => t.role === "main");
        return live?.id ?? null;
      }

      if (hasGraphql(admin)) {
        const query = `
          query MainThemeId {
            themes(first: 50) {
              nodes {
                id
                role
              }
            }
          }
        `;
        const payload = await graphqlJson(admin, query, {});
        const themes = payload?.data?.themes?.nodes || [];
        const live = themes.find(
          (t) => toLower(t?.role) === "main" || t?.role === "MAIN"
        );
        return live?.id ?? null;
      }

      throw new Error("Theme listing unavailable: no REST or GraphQL transport");
    });
    return cached ?? null;
  } catch (error) {
    console.error("[theme-embed] theme list failed:", error);
    return null;
  }
}

export async function getThemeEmbedState({
  admin,
  shop,
  themeId,
  apiKey,
  extId,
  embedHandle = APP_EMBED_HANDLE,
}) {
  try {
    if (!themeId) return { enabled: false, found: false, checked: false };

    const settingsRaw = await fetchThemeSettingsData({ admin, themeId });
    if (!settingsRaw) return { enabled: false, found: false, checked: false };

    let parsed = null;
    try {
      parsed = JSON.parse(settingsRaw);
    } catch {
      return { enabled: false, found: false, checked: false };
    }

    // --- DEBUG: log current structure ---
    console.log("[theme-embed:debug] themeId:", themeId, "| current type:", typeof parsed?.current);
    const entries = getActiveRootBlockEntries(parsed);
    console.log("[theme-embed:debug] root block entries:", entries.length);
    entries.forEach(({ blockId, block }) => {
      console.log(
        `[theme-embed:debug]   blockId=${blockId} | type=${block?.type} | disabled=${JSON.stringify(block?.disabled)}`
      );
    });
    // --- END DEBUG ---

    if (!entries.length) {
      return { enabled: false, found: false, checked: true };
    }

    const handleToken = toLower(embedHandle);
    const handleVariants = Array.from(
      new Set([
        handleToken,
        handleToken.replace(/-/g, "_"),
        handleToken.replace(/_/g, "-"),
        handleToken.replace(/[-_]/g, ""),
      ])
    ).filter(Boolean);
    const normalizedHandleVariants = handleVariants
      .map((item) => normalizeToken(item))
      .filter(Boolean);
    const appMarkers = Array.from(
      new Set(
        [apiKey, extId, embedHandle, "fomoify", "fomo", "coreembed"]
          .map((item) => normalizeToken(item))
          .filter(Boolean)
      )
    );

    const matches = entries
      .filter(({ blockId, block }) => {
        const type = toLower(block?.type);
        if (!type) return false;

        const normalizedType = normalizeToken(type);
        const normalizedBlockId = normalizeToken(blockId);
        const normalizedName = normalizeToken(
          block?.name || block?.settings?.name
        );
        const normalizedTarget = normalizeToken(
          block?.target || block?.settings?.target
        );
        const hasAppType =
          type.includes("shopify://apps/") ||
          type.includes("/apps/") ||
          normalizedType.includes("shopifyapps") ||
          normalizedBlockId.includes("shopifyapps");
        if (!hasAppType) {
          return false;
        }

        const haystack = `${normalizedType} ${normalizedBlockId} ${normalizedName} ${normalizedTarget}`;
        const hasHandleMatch = normalizedHandleVariants.some((variant) =>
          haystack.includes(variant)
        );
        if (hasHandleMatch) return true;
        const hasAppMarker = appMarkers.some((marker) => haystack.includes(marker));
        const hasEmbedHint =
          normalizedType.includes("embed") ||
          normalizedBlockId.includes("embed") ||
          normalizedName.includes("embed") ||
          normalizedTarget.includes("embed") ||
          normalizedType.includes("appblock");
        return hasAppMarker && hasEmbedHint;
      })
      .map(({ block }) => block);
    const found = matches.length > 0;
    const enabled = matches.some((block) => !toBool(block?.disabled));

    // --- DEBUG: log match result ---
    console.log("[theme-embed:debug] matched blocks:", matches.length, "| found:", found, "| enabled:", enabled);
    matches.forEach((block, i) => {
      console.log(`[theme-embed:debug]   match[${i}] type=${block?.type} disabled=${JSON.stringify(block?.disabled)}`);
    });
    // --- END DEBUG ---

    return { enabled, found, checked: true };
  } catch (error) {
    console.error("[theme-embed] embed detect failed:", error);
    return { enabled: false, found: false, checked: false };
  }
}

export async function getAppEmbedContext({
  admin,
  shop,
  apiKey,
  extId,
  embedHandle = APP_EMBED_HANDLE,
}) {
  const themeId = await getMainThemeId({ admin, shop });
  const state = await getThemeEmbedState({
    admin,
    shop,
    themeId,
    apiKey,
    extId,
    embedHandle,
  });
  return {
    themeId: themeId ?? null,
    appEmbedEnabled: Boolean(state?.enabled),
    appEmbedFound: Boolean(state?.found),
    appEmbedChecked: Boolean(state?.checked),
  };
}
