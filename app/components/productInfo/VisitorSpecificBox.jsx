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
  const [productCache, setProductCache] = useState({});
  const products = useMemo(
    () => (productFetcher.data?.items || []).map(normalizeProduct),
    [productFetcher.data]
  );
  const isLoading = productFetcher.state !== "idle";
  const hasNextPage = Boolean(productFetcher.data?.hasNextPage);

  useEffect(() => {
    if (!productModalOpen) return;
    const params = new URLSearchParams({
      q: query,
      page: String(page),
    });
    productFetcher.load(`/app/products-picker?${params.toString()}`);
  }, [productModalOpen, query, page]);

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
          <BlockStack gap="100">
            <Text as="h3" variant="headingSm">
              Visitor display
            </Text>
            <Text as="p" tone="subdued">
              Choose where the visitor count should appear.
            </Text>
          </BlockStack>
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
        {productScope === "specific" && (
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="p" tone="subdued">
                Select specific products where visitor count should show.
              </Text>
              <Button onClick={() => setProductModalOpen(true)}>Select products</Button>
            </InlineStack>
            {selectedProducts.length ? (
              <InlineStack gap="200" wrap>
                {selectedProducts.map((product) => (
                  <Badge key={product.id}>{product.title}</Badge>
                ))}
              </InlineStack>
            ) : (
              <Text as="p" tone="critical">
                No products selected.
              </Text>
            )}
          </BlockStack>
        )}
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
              <Text as="p" tone="subdued">
                No products found.
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
