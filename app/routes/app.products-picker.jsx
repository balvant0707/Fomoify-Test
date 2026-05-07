// app/routes/app.products-picker.jsx
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getOrSetCache } from "../utils/serverCache.server";

/**
 * GET /app/products-picker?q=shirt
 * Returns matching products in a single response by walking Shopify pages.
 */
export async function loader({ request }) {
  try {
    const { admin, session } = await authenticate.admin(request);

    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";
    const rawLimit = Number(url.searchParams.get("limit") || "5000");
    const maxProducts = Number.isFinite(rawLimit)
      ? Math.max(1, Math.min(5000, Math.trunc(rawLimit)))
      : 5000;

    const query = `
      query ProductsPicker($query: String, $first: Int!, $after: String) {
        products(first: $first, after: $after, query: $query, sortKey: TITLE) {
          edges {
            cursor
            node {
              id
              title
              handle
              status
              featuredImage { url altText }
              totalInventory
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;

    const cacheKey = `products-picker:${session?.shop}:${q}:${maxProducts}`;

    const payload = await getOrSetCache(cacheKey, 30000, async () => {
      const edges = [];
      let after = null;
      let hasNextPage = true;

      while (hasNextPage && edges.length < maxProducts) {
        const first = Math.min(250, maxProducts - edges.length);
        const res = await admin.graphql(query, {
          variables: {
            query: q ? `title:*${q}*` : null,
            first,
            after,
          },
        });
        const data = await res.json();

        if (Array.isArray(data?.errors) && data.errors.length) {
          const message = data.errors
            .map((error) => error?.message)
            .filter(Boolean)
            .join("; ");
          throw new Error(message || "Failed to load products");
        }

        const block = data?.data?.products;
        const pageEdges = Array.isArray(block?.edges) ? block.edges : [];
        edges.push(...pageEdges);

        hasNextPage =
          Boolean(block?.pageInfo?.hasNextPage) && edges.length < maxProducts;
        after =
          block?.pageInfo?.endCursor ||
          pageEdges[pageEdges.length - 1]?.cursor ||
          null;

        if (!after) break;
      }

      return {
        items: edges.map(({ node: p }) => ({
          id: p.id,
          title: p.title,
          handle: p.handle,
          status: p.status,
          image: p.featuredImage?.url || null,
          featuredImage: p.featuredImage?.url || null,
          totalInventory: p.totalInventory,
        })),
        totalCount: edges.length,
        hasNextPage: false,
      };
    });

    return json(payload);
  } catch (e) {
    if (e instanceof Response) throw e;
    console.error("[products-picker] loader failed:", e);
    return json(
      { items: [], error: e?.message || "Failed to load products" },
      { status: 500 }
    );
  }
}
