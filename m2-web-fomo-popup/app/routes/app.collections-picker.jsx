// app/routes/app.collections-picker.jsx
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getOrSetCache } from "../utils/serverCache.server";

/**
 * GET /app/collections-picker?q=sale&page=1
 * Returns paginated collections for the picker modal
 */
export async function loader({ request }) {
  try {
    const { admin, session } = await authenticate.admin(request);

    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = 20;

    const query = `
      query CollectionsPicker($query: String, $first: Int!, $after: String) {
        collections(first: $first, query: $query, after: $after, sortKey: TITLE) {
          edges {
            cursor
            node {
              id
              title
              handle
              image { url altText }
              products(first: 1) {
                nodes {
                  id
                  title
                  handle
                  featuredImage { url altText }
                }
              }
            }
          }
          pageInfo { hasNextPage hasPreviousPage }
        }
      }
    `;

    const cacheKey = `collections-picker:${session?.shop}:${q}:${page}`;

    const payload = await getOrSetCache(cacheKey, 30000, async () => {
      let after = null;
      let collected = [];
      let hasNextPage = true;

      // simple page+cursor advance
      for (let currentPage = 1; currentPage <= page && hasNextPage; currentPage++) {
        const res = await admin.graphql(query, {
          variables: {
            query: q ? `title:*${q}*` : null,
            first: pageSize,
            after,
          },
        });
        const data = await res.json();
        const edges = data?.data?.collections?.edges || [];
        hasNextPage = data?.data?.collections?.pageInfo?.hasNextPage || false;
        after = edges.length ? edges[edges.length - 1].cursor : null;

        if (currentPage === page) {
          collected = edges.map((e) => e.node);
          break;
        }
      }

      return {
        items: collected.map((c) => {
          const sample = c?.products?.nodes?.[0] || null;
          return {
            id: c.id,
            title: c.title,
            handle: c.handle,
            productsCount:
              c.productsCount ?? c?.products?.nodes?.length ?? 0,
            image: c.image?.url || null,
            sampleProduct: sample
              ? {
                  id: sample.id,
                  title: sample.title,
                  handle: sample.handle,
                  image: sample.featuredImage?.url || null,
                }
              : null,
          };
        }),
        page,
        pageSize,
        hasNextPage,
      };
    });

    return json(payload);
  } catch (e) {
    // Let Remix handle redirects/auth responses
    if (e instanceof Response) throw e;
    console.error("[collections-picker] loader failed:", e);
    return json(
      { items: [], error: e?.message || "Failed to load collections" },
      { status: 500 }
    );
  }
}
