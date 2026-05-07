import { useEffect, useMemo, useState } from "react";
import { useFetcher } from "@remix-run/react";
import {
  Badge,
  BlockStack,
  Button,
  Checkbox,
  IndexTable,
  InlineStack,
  Modal,
  Select,
  Text,
  TextField,
  Thumbnail,
} from "@shopify/polaris";

const productScopeOptions = [
  { label: "All products", value: "all" },
  { label: "Specific products", value: "specific" },
];

const normalizeProduct = (product) => ({
  id: product.id,
  title: product.title || "Untitled product",
  image: product.featuredImage || product.image || "",
  status: product.status || "",
  inventory: Number(product.totalInventory ?? product.inventory ?? 0),
});

const isActiveProduct = (status) =>
  String(status || "").toLowerCase() === "active";

export default function VisitorSpecificBox({
  productScope,
  setProductScope,
  productModalOpen,
  setProductModalOpen,
  selectedProductIds,
  setSelectedProductIds,
}) {
  const productFetcher = useFetcher();
  const [query, setQuery] = useState("");
  const [productCache, setProductCache] = useState({});

  const products = useMemo(() => {
    const items = productFetcher.data?.items || [];
    if (!Array.isArray(items)) return [];
    return items.map(normalizeProduct);
  }, [productFetcher.data]);

  const isLoading = productFetcher.state !== "idle";
  const productError = productFetcher.data?.error || "";

  const loadProducts = (nextQuery = query) => {
    const params = new URLSearchParams();
    if (nextQuery) params.set("q", nextQuery);
    productFetcher.load(`/app/products-picker?${params.toString()}`);
  };

  // Load once on mount
  useEffect(() => {
    loadProducts("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload when search query changes
  useEffect(() => {
    if (!productModalOpen) return;
    loadProducts(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    if (!products.length) return;
    setProductCache((current) => {
      const next = { ...current };
      products.forEach((product) => {
        next[product.id] = product;
      });
      return next;
    });
  }, [products]);

  const selectedProducts = selectedProductIds
    .map((id) => productCache[id])
    .filter(Boolean);

  const toggleProduct = (id) => {
    setSelectedProductIds((current) =>
      current.includes(id)
        ? current.filter((productId) => productId !== id)
        : [...current, id]
    );
  };

  return (
    <>
      <BlockStack gap="300">
        <Select
          label="Show visitor count on"
          options={productScopeOptions}
          value={productScope}
          onChange={setProductScope}
        />
        <BlockStack gap="300">
          {productScope === "specific" && (
            <InlineStack align="space-between" blockAlign="center">
              <Button onClick={() => setProductModalOpen(true)}>
                Select products
              </Button>
            </InlineStack>
          )}
          {productScope === "specific" &&
            (selectedProducts.length ? (
              <InlineStack gap="200" wrap>
                {selectedProducts.map((product) => (
                  <Badge key={product.id}>{product.title}</Badge>
                ))}
              </InlineStack>
            ) : (
              <Text as="p" tone="critical">
                No products selected.
              </Text>
            ))}
        </BlockStack>
      </BlockStack>

      <Modal
        open={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        title="Select visitor products"
        primaryAction={{
          content: "Done",
          onAction: () => setProductModalOpen(false),
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setProductModalOpen(false),
          },
        ]}
        large
      >
        <Modal.Section>
          <BlockStack gap="300">
            <TextField
              label="Search products"
              placeholder="Search products"
              value={query}
              onChange={(next) => setQuery(next)}
              autoComplete="off"
            />
            {isLoading ? (
              <Text as="p" tone="subdued">Loading products…</Text>
            ) : (
              <IndexTable
                selectable={false}
                itemCount={products.length}
                resourceName={{ singular: "product", plural: "products" }}
                headings={[
                  { title: "" },
                  { title: "Product" },
                  { title: "Status" }
                ]}
              >
                {products.map((product, index) => (
                  <IndexTable.Row id={product.id} key={product.id} position={index}>
                    <IndexTable.Cell>
                      <Checkbox
                        label=""
                        labelHidden
                        checked={selectedProductIds.includes(product.id)}
                        onChange={() => toggleProduct(product.id)}
                      />
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <InlineStack gap="300" blockAlign="center">
                        <Thumbnail
                          source={product.image || ""}
                          alt={product.title}
                          size="small"
                        />
                        <Text as="span" style="fontWeight: semibold,fontSize: 12px !important">
                          {product.title}
                        </Text>
                      </InlineStack>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Badge tone={isActiveProduct(product.status) ? "success" : "attention"}>
                        {product.status}
                      </Badge>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
            )}
            {!products.length && !isLoading && (
              <Text as="p" tone={productError ? "critical" : "subdued"}>
                {productError || "No products found."}
              </Text>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </>
  );
}
