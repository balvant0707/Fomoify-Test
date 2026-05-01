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

const sampleProducts = [
  {
    id: "bedside-table",
    title: "Bedside Table",
    image:
      "https://cdn.shopify.com/s/files/1/0690/3572/0758/files/dark-wall-bedside-table_925x_b29fc806-9f57-4768-857c-85bbb9a41f9b.jpg?v=1756986561",
    status: "Active",
    inventory: 8,
  },
  {
    id: "blue-ball-gown",
    title: "Dreamy Blue Ball Gown",
    image: "",
    status: "Active",
    inventory: 3,
  },
  {
    id: "classic-watch",
    title: "Classic Watch",
    image: "",
    status: "Draft",
    inventory: 0,
  },
];

export default function StockSpecificBox({
  productScope,
  setProductScope,
  productModalOpen,
  setProductModalOpen,
  selectedProductIds,
  setSelectedProductIds,
}) {
  const selectedProducts = sampleProducts.filter((product) =>
    selectedProductIds.includes(product.id)
  );

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
              Stock display
            </Text>
            <Text as="p" tone="subdued">
              Choose where the stock status should appear.
            </Text>
          </BlockStack>
          <Badge tone={productScope === "all" ? "success" : "info"}>
            {productScope === "all" ? "All products" : `${selectedProducts.length} selected`}
          </Badge>
        </InlineStack>
        <Select
          label="Show stock status on"
          options={productScopeOptions}
          value={productScope}
          onChange={setProductScope}
        />
        {productScope === "specific" && (
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="p" tone="subdued">
                Select specific products where stock status should show.
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
        title="Select stock products"
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
              autoComplete="off"
              disabled
            />
            <IndexTable
              selectable={false}
              itemCount={sampleProducts.length}
              resourceName={{ singular: "product", plural: "products" }}
              headings={[
                { title: "" },
                { title: "Product" },
                { title: "Status" },
                { title: "Inventory" },
              ]}
            >
              {sampleProducts.map((product, index) => (
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
                    <Badge tone={product.status === "Active" ? "success" : "attention"}>
                      {product.status}
                    </Badge>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span">{product.inventory}</Text>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </>
  );
}
