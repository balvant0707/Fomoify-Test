import { Card, IndexTable, Text } from "@shopify/polaris";

export default function LogsTable({ items }) {
  const rows = Array.isArray(items) ? items : [];

  return (
    <Card>
      <IndexTable
        resourceName={{ singular: "log", plural: "logs" }}
        itemCount={rows.length}
        selectable={false}
        headings={[
          { title: "ID" },
          { title: "Type" },
          { title: "Message" },
          { title: "Pages" },
          { title: "Status" },
        ]}
      >
        {rows.map((row, index) => (
          <IndexTable.Row id={String(row.id)} key={row.id} position={index}>
            <IndexTable.Cell>
              <Text as="span">{row.id}</Text>
            </IndexTable.Cell>
            <IndexTable.Cell>{row.key}</IndexTable.Cell>
            <IndexTable.Cell>
              <Text as="span" breakWord>
                {row.messageText || "-"}
              </Text>
            </IndexTable.Cell>
            <IndexTable.Cell>{row.showType || "-"}</IndexTable.Cell>
            <IndexTable.Cell>{row.enabled ? "enabled" : "disabled"}</IndexTable.Cell>
          </IndexTable.Row>
        ))}
      </IndexTable>
    </Card>
  );
}
