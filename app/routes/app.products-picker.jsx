// app/routes/app.products-picker.jsx
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getOrSetCache } from "../utils/serverCache.server";

/**
 * GET /app/products-picker?q=shirt
 * Returns up to 250 products in a single page (no pagination).
 */
export async function loader({ request }) {
  try {
    const { admin, session } = await authenticate.admin(request);

    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";

    const query = `
      query ProductsPicker($query: String, $first: Int!) {
        products(first: $first, query: $query, sortKey: TITLE) {
          edges {
            node {
              id
              title
              handle
              status
              featuredImage { url altText }
              totalInventory
            }
          }
          pageInfo { hasNextPage }
        }
      }
    `;

    const cacheKey = `products-picker:${session?.shop}:${q}`;

    const payload = await getOrSetCache(cacheKey, 30000, async () => {
      const res = await admin.graphql(query, {
        variables: {
          query: q ? `title:*${q}*` : null,
          first: 250,
        },
      });
      const data = await res.json();
      const edges = data?.data?.products?.edges || [];

      return {
        items: edges.map(({ node: p }) => ({
          id: p.id,
          title: p.title,
          handle: p.handle,
          status: p.status,
          featuredImage: p.featuredImage?.url || null,
          totalInventory: p.totalInventory,
        })),
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
