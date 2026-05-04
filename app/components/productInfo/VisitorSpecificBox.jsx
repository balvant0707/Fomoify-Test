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
  const [page, setPage] = useState(1);
  const [hasLoadedProducts, setHasLoadedProducts] = useState(false);
  const [productCache, setProductCache] = useState({});
  const products = useMemo(
    () => {
      const items = productFetcher.data?.items || [];
      if (!Array.isArray(items)) return [];
      return items.map(normalizeProduct);
    },
    [productFetcher.data]
  );
  const isLoading = productFetcher.state !== "idle";
  const hasNextPage = Boolean(productFetcher.data?.hasNextPage);
  const productError = productFetcher.data?.error || "";

  const loadProducts = (nextQuery = query, nextPage = page) => {
    const params = new URLSearchParams();
    if (nextQuery) params.set("q", nextQuery);
    params.set("page", String(nextPage));
    productFetcher.load(`/app/products-picker?${params.toString()}`);
  };

  useEffect(() => {
    if (hasLoadedProducts) return;
    loadProducts("", 1);
    setHasLoadedProducts(true);
  }, [hasLoadedProducts, productFetcher]);

  useEffect(() => {
    if (!productModalOpen) return;
    loadProducts(query, page);
  }, [productModalOpen, query, page, productFetcher]);

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
        <InlineStack align="space-between" blockAlign="center">
          <Badge tone={productScope === "all" ? "success" : "info"}>
            {productScope === "all" ? "All products" : `${selectedProducts.length} selected`}
          </Badge>
        </InlineStack>
        <Select
          label="Show visitor count on"
          options={productScopeOptions}
          value={productScope}
          onChange={setProductScope}
        />
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="p" tone="subdued">
              {productScope === "specific"
                ? "Select specific products where visitor count should show."
                : "All store products are included."}
            </Text>
            <Button onClick={() => setProductModalOpen(true)}>
              {productScope === "specific" ? "Select products" : "View products"}
            </Button>
          </InlineStack>
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
              onChange={(next) => {
                setQuery(next);
                setPage(1);
              }}
              autoComplete="off"
            />
            <IndexTable
              selectable={false}
              itemCount={products.length}
              resourceName={{ singular: "product", plural: "products" }}
              headings={[
                { title: "" },
                { title: "Product" },
                { title: "Status" },
                { title: "Inventory" },
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
                      <Text as="span" fontWeight="semibold">
                        {product.title}
                      </Text>
                    </InlineStack>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Badge tone={isActiveProduct(product.status) ? "success" : "attention"}>
                      {product.status}
                    </Badge>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span">{product.inventory}</Text>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
            {!products.length && !isLoading && (
              <Text as="p" tone={productError ? "critical" : "subdued"}>
                {productError || "No products found."}
              </Text>
            )}
            <InlineStack align="space-between" blockAlign="center">
              <Text as="span" tone="subdued">
                {isLoading ? "Loading products..." : `Page ${page}`}
              </Text>
              <InlineStack gap="200">
                <Button disabled={page <= 1 || isLoading} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                  Previous
                </Button>
                <Button disabled={!hasNextPage || isLoading} onClick={() => setPage((value) => value + 1)}>
                  Next
                </Button>
              </InlineStack>
            </InlineStack>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </>
  );
}
