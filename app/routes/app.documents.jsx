import { useState } from "react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Collapsible,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

const POPUP_DOCS = [
  {
    key: "recent",
    title: "1) Recent Purchases Popup",
    summary:
      "This popup shows real purchase activity from Shopify orders. Use this when you want social proof.",
    groups: [
      {
        key: "recent-content-data",
        title: "Content And Data Fields",
        fields: [
          {
            name: "messageText",
            description: "Main text line shown after purchase context.",
          },
          {
            name: "orderDays",
            description:
              "Fetch window for orders. Allowed range is 1 to 60 days.",
          },
          {
            name: "createOrderTime",
            description:
              "Latest order timestamp in selected window (reference field).",
          },
          {
            name: "namesJson",
            description:
              "Hide fields list. Can hide name/city/state/country/productTitle/productImage/time.",
          },
          {
            name: "productNameMode",
            description:
              "full = show full product title, half = show shortened title.",
          },
          {
            name: "productNameLimit",
            description:
              "Character limit applied when productNameMode is half.",
          },
          {
            name: "selectedProductsJson",
            description: "Product list used for selection/scope mapping.",
          },
          {
            name: "locationsJson, messageTitlesJson",
            description:
              "Additional arrays used by popup data/rendering workflows.",
          },
        ],
      },
      {
        key: "recent-display",
        title: "Display Fields",
        fields: [
          {
            name: "enabled",
            description: "Master on/off toggle for popup.",
          },
          {
            name: "showType",
            description:
              "Derived display target. Controlled by page checkboxes.",
          },
          {
            name: "showHome, showProduct, showCollectionList, showCollection, showCart",
            description: "Page-level visibility controls.",
          },
          {
            name: "position",
            description: "Desktop popup position.",
          },
          {
            name: "mobilePosition",
            description: "Mobile popup position.",
          },
          {
            name: "mobileSize",
            description: "Mobile size preset.",
          },
        ],
      },
      {
        key: "recent-design-font",
        title: "Design And Font Fields",
        fields: [
          { name: "layout", description: "Landscape or portrait layout." },
          { name: "template", description: "Solid or gradient template." },
          {
            name: "imageAppearance",
            description: "Product image fit mode: cover or contain.",
          },
          { name: "fontFamily", description: "Text font family." },
          { name: "fontWeight", description: "Text weight for emphasis." },
          {
            name: "rounded",
            description: "Text size control in px for this popup.",
          },
          {
            name: "bgColor, bgAlt, textColor, numberColor",
            description: "Main visual color controls.",
          },
          {
            name: "priceTagBg, priceTagAlt, priceColor, starColor",
            description: "Price and accent color controls.",
          },
        ],
      },
      {
        key: "recent-behavior",
        title: "Behavior And Timing Fields",
        fields: [
          { name: "animation", description: "Popup animation style." },
          {
            name: "firstDelaySeconds",
            description: "Delay before first popup appears.",
          },
          {
            name: "durationSeconds",
            description: "How long each popup remains visible.",
          },
          {
            name: "alternateSeconds",
            description: "Gap between popups in seconds.",
          },
          {
            name: "intervalUnit",
            description: "Interval unit selector (seconds/minutes).",
          },
        ],
      },
      {
        key: "recent-examples",
        title: "Ready Content Examples",
        items: [
          "bought this product recently",
          "placed an order recently",
          "just purchased this item",
          "ordered this product a few minutes ago",
        ],
      },
    ],
  },
  {
    key: "flash",
    title: "2) Flash Sale / Countdown Bar",
    summary:
      "This bar rotates headline, offer title, and urgency message values for campaign-style announcements.",
    groups: [
      {
        key: "flash-content",
        title: "Content Fields",
        fields: [
          { name: "messageTitle", description: "Headline text." },
          { name: "name", description: "Offer title/discount title text." },
          { name: "messageText", description: "Countdown/urgency text." },
          {
            name: "messageTitlesJson",
            description: "Multiple headline values (chips list).",
          },
          {
            name: "locationsJson",
            description: "Multiple offer title values (chips list).",
          },
          {
            name: "namesJson",
            description: "Multiple urgency values (chips list).",
          },
        ],
      },
      {
        key: "flash-display",
        title: "Display Fields",
        fields: [
          { name: "enabled", description: "Master on/off for flash bar." },
          {
            name: "showType",
            description:
              "Derived visibility target from page checkboxes.",
          },
          {
            name: "showHome, showProduct, showCollectionList, showCollection, showCart",
            description: "Page visibility controls.",
          },
          { name: "position", description: "Desktop bar position." },
          { name: "mobilePosition", description: "Mobile bar position." },
          { name: "mobileSize", description: "Compact/comfortable/large." },
        ],
      },
      {
        key: "flash-design-font",
        title: "Design And Font Fields",
        fields: [
          { name: "layout", description: "Landscape or portrait style." },
          { name: "template", description: "Solid or gradient template." },
          {
            name: "imageAppearance",
            description: "Icon/image fit mode: cover or contain.",
          },
          { name: "fontFamily", description: "Flash bar font family." },
          { name: "fontWeight", description: "Text weight." },
          {
            name: "rounded",
            description: "Text size value in px for bar copy.",
          },
          {
            name: "iconKey, iconSvg",
            description:
              "Built-in icon or uploaded SVG icon source.",
          },
          {
            name: "bgColor, bgAlt, textColor, numberColor",
            description: "Main bar color controls.",
          },
          {
            name: "priceTagBg, priceTagAlt, priceColor, starColor",
            description: "Price/accent color controls.",
          },
        ],
      },
      {
        key: "flash-behavior",
        title: "Behavior And Timing Fields",
        fields: [
          { name: "animation", description: "Fade/slide/bounce/zoom style." },
          {
            name: "firstDelaySeconds",
            description: "Initial delay before first item.",
          },
          {
            name: "durationSeconds",
            description: "Display duration for each item.",
          },
          {
            name: "alternateSeconds",
            description: "Interval gap between items.",
          },
          {
            name: "intervalUnit",
            description: "Interval unit (seconds/minutes).",
          },
        ],
      },
      {
        key: "flash-examples",
        title: "Ready Content Examples",
        items: [
          "Headline: Flash Sale | Weekend Deal | Limited Time Offer",
          "Offer: Extra 15% OFF | Buy 2 Get 1 | Free Shipping Over Rs. 999",
          "Countdown: ends in 02:15 hours | valid today | closes at 11:59 PM",
        ],
      },
    ],
  },
  {
    key: "visitor",
    title: "3) Visitor Popup",
    summary:
      "Visitor popup supports visitor list and visitor counter mode with tokenized content.",
    groups: [
      {
        key: "visitor-content",
        title: "Content Fields",
        fields: [
          {
            name: "design.notiType",
            description:
              "visitor_list or visitor_counter mode selection.",
          },
          {
            name: "content.message",
            description: "Main message template with tokens.",
          },
          {
            name: "content.timestamp",
            description: "Timestamp text with token support.",
          },
          {
            name: "content.avgTime, content.avgUnit",
            description: "Fallback relative time values.",
          },
          {
            name: "productNameMode, productNameLimit",
            description: "Product title full/half and character limit.",
          },
        ],
      },
      {
        key: "visitor-data",
        title: "Data Fields",
        fields: [
          {
            name: "data.directProductPage",
            description: "Open product page on popup click.",
          },
          {
            name: "data.showProductImage",
            description: "Show/hide product image.",
          },
          {
            name: "data.showPriceTag",
            description: "Show/hide price section.",
          },
          {
            name: "data.showRating, data.ratingSource",
            description: "Enable rating and choose rating source.",
          },
          {
            name: "data.customerInfo",
            description: "Customer data source behavior.",
          },
          {
            name: "selectedDataProducts, selectedVisibilityProducts, selectedCollections",
            description: "Manual selection buckets for targeting.",
          },
        ],
      },
      {
        key: "visitor-display",
        title: "Display Fields",
        fields: [
          {
            name: "visibility.showHome, visibility.showProduct, visibility.showCollectionList, visibility.showCollection, visibility.showCart",
            description: "Page level visibility toggles.",
          },
          {
            name: "visibility.productScope, visibility.collectionScope",
            description: "All items or specific items scope.",
          },
          {
            name: "visibility.position",
            description: "Popup position on storefront.",
          },
        ],
      },
      {
        key: "visitor-design-font",
        title: "Design And Font Size Fields",
        fields: [
          {
            name: "design.layout, design.size, design.transparent",
            description: "Layout, width scale, and transparency.",
          },
          {
            name: "design.template, design.imageAppearance",
            description: "Template and image fit.",
          },
          {
            name: "design.bgColor, design.bgAlt, design.textColor, design.timestampColor",
            description: "Main text and background colors.",
          },
          {
            name: "design.priceTagBg, design.priceTagAlt, design.priceColor, design.starColor",
            description: "Price and rating accent colors.",
          },
          {
            name: "textSize.content",
            description: "Main content font size (px).",
          },
          {
            name: "textSize.compareAt",
            description: "Compare-at price font size (px).",
          },
          {
            name: "textSize.price",
            description: "Price tag font size (px).",
          },
        ],
      },
      {
        key: "visitor-behavior",
        title: "Behavior Fields",
        fields: [
          {
            name: "behavior.showClose, behavior.hideOnMobile",
            description: "Close icon and mobile hide control.",
          },
          {
            name: "behavior.delay, behavior.duration",
            description: "Initial delay and display duration.",
          },
          {
            name: "behavior.interval, behavior.intervalUnit, behavior.randomize",
            description: "Repetition interval and randomization.",
          },
        ],
      },
      {
        key: "visitor-tokens",
        title: "Supported Tokens",
        items: [
          "{full_name}, {first_name}, {last_name}",
          "{product_name}, {country}, {city}, {price}",
          "{visitor_count}, {time}, {unit}",
        ],
      },
      {
        key: "visitor-examples",
        title: "Ready Content Examples",
        items: [
          "{full_name} from {country} just viewed this {product_name}",
          "{visitor_count} people are viewing {product_name} right now",
          "Timestamp: Just now | {time} {unit} ago",
        ],
      },
    ],
  },
  {
    key: "lowstock",
    title: "4) Low Stock Popup",
    summary:
      "Low stock popup shows urgency based on inventory threshold and selected products.",
    groups: [
      {
        key: "lowstock-content",
        title: "Content Fields",
        fields: [
          {
            name: "content.message",
            description: "Low-stock message with tokens.",
          },
          {
            name: "productNameMode, productNameLimit",
            description: "Product title formatting control.",
          },
        ],
      },
      {
        key: "lowstock-data",
        title: "Data Fields",
        fields: [
          {
            name: "data.dataSource",
            description: "shopify or manual data source.",
          },
          {
            name: "data.stockUnder",
            description: "Threshold: show products below this stock count.",
          },
          {
            name: "data.hideOutOfStock",
            description: "Hide products with zero stock.",
          },
          {
            name: "data.directProductPage",
            description: "Open product page on click.",
          },
          {
            name: "data.showProductImage, data.showPriceTag, data.showRating",
            description: "Visual blocks toggle controls.",
          },
          {
            name: "selectedDataProducts, selectedVisibilityProducts, selectedCollections",
            description: "Manual target selections.",
          },
        ],
      },
      {
        key: "lowstock-display",
        title: "Display Fields",
        fields: [
          {
            name: "visibility.showHome, visibility.showProduct, visibility.showCollectionList, visibility.showCollection, visibility.showCart",
            description: "Page visibility toggles.",
          },
          {
            name: "visibility.productScope, visibility.collectionScope",
            description: "Scope filtering options.",
          },
          { name: "visibility.position", description: "Popup position." },
        ],
      },
      {
        key: "lowstock-design-font",
        title: "Design And Font Size Fields",
        fields: [
          {
            name: "design.layout, design.size, design.transparent",
            description: "Layout, width scale, and transparency.",
          },
          {
            name: "design.template, design.imageAppearance",
            description: "Template and image fit control.",
          },
          {
            name: "design.bgColor, design.bgAlt, design.textColor, design.numberColor",
            description: "Core color controls.",
          },
          {
            name: "design.priceTagBg, design.priceTagAlt, design.priceColor, design.starColor",
            description: "Price/rating accent colors.",
          },
          {
            name: "textSize.content, textSize.compareAt, textSize.price",
            description: "All text size controls in px.",
          },
        ],
      },
      {
        key: "lowstock-behavior",
        title: "Behavior Fields",
        fields: [
          {
            name: "behavior.showClose, behavior.hideOnMobile",
            description: "Close icon and mobile visibility.",
          },
          {
            name: "behavior.delay, behavior.duration",
            description: "Display timing controls.",
          },
          {
            name: "behavior.interval, behavior.intervalUnit, behavior.randomize",
            description: "Repeat interval controls.",
          },
        ],
      },
      {
        key: "lowstock-tokens",
        title: "Supported Tokens",
        items: [
          "{product_name}, {product_price}, {stock_count}",
          "{full_name}, {first_name}, {last_name}",
          "{country}, {city}, {time}, {unit}",
        ],
      },
      {
        key: "lowstock-examples",
        title: "Ready Content Examples",
        items: [
          "{product_name} has only {stock_count} items left in stock",
          "Hurry! only {stock_count} left for {product_name}",
          "Almost sold out: {product_name} stock is {stock_count}",
        ],
      },
    ],
  },
  {
    key: "addtocart",
    title: "5) Add To Cart Notification",
    summary:
      "Add to cart notification shows cart activity using Shopify/manual product and customer information.",
    groups: [
      {
        key: "addtocart-content",
        title: "Content Fields",
        fields: [
          {
            name: "content.message",
            description: "Main add-to-cart line with tokens.",
          },
          {
            name: "content.timestamp",
            description: "Relative time line with token support.",
          },
          {
            name: "content.avgTime, content.avgUnit",
            description: "Fallback time values.",
          },
          {
            name: "productNameMode, productNameLimit",
            description: "Product title display mode and limit.",
          },
        ],
      },
      {
        key: "addtocart-data",
        title: "Data Fields",
        fields: [
          { name: "data.dataSource", description: "shopify or manual source." },
          {
            name: "data.customerInfo",
            description: "Customer data source selection.",
          },
          {
            name: "data.stockUnder, data.hideOutOfStock",
            description: "Stock filtering controls if used.",
          },
          {
            name: "data.directProductPage",
            description: "Open product page on popup click.",
          },
          {
            name: "data.showProductImage, data.showPriceTag, data.showRating",
            description: "Show/hide product information blocks.",
          },
          {
            name: "selectedDataProducts, selectedVisibilityProducts, selectedCollections",
            description: "Manual target selection fields.",
          },
        ],
      },
      {
        key: "addtocart-display",
        title: "Display Fields",
        fields: [
          {
            name: "visibility.showHome, visibility.showProduct, visibility.showCollectionList, visibility.showCollection, visibility.showCart",
            description: "Page visibility toggles.",
          },
          {
            name: "visibility.productScope, visibility.collectionScope",
            description: "All vs specific scope settings.",
          },
          { name: "visibility.position", description: "Popup display position." },
        ],
      },
      {
        key: "addtocart-design-font",
        title: "Design And Font Size Fields",
        fields: [
          {
            name: "design.layout, design.size, design.transparent",
            description: "Layout, scale, and transparency.",
          },
          {
            name: "design.template, design.imageAppearance",
            description: "Template and image fit setting.",
          },
          {
            name: "design.bgColor, design.bgAlt, design.textColor, design.timestampColor",
            description: "Main color settings.",
          },
          {
            name: "design.priceTagBg, design.priceTagAlt, design.priceColor, design.starColor",
            description: "Price and rating accent colors.",
          },
          {
            name: "textSize.content, textSize.compareAt, textSize.price",
            description: "All text size fields in px.",
          },
        ],
      },
      {
        key: "addtocart-behavior",
        title: "Behavior Fields",
        fields: [
          {
            name: "behavior.showClose, behavior.hideOnMobile",
            description: "Close icon and mobile hide control.",
          },
          {
            name: "behavior.delay, behavior.duration",
            description: "Display timing controls.",
          },
          {
            name: "behavior.interval, behavior.intervalUnit, behavior.randomize",
            description: "Repeat timing and randomization.",
          },
        ],
      },
      {
        key: "addtocart-tokens",
        title: "Supported Tokens",
        items: [
          "{full_name}, {first_name}, {last_name}",
          "{country}, {city}, {product_name}, {product_price}",
          "{time}, {unit}",
        ],
      },
      {
        key: "addtocart-examples",
        title: "Ready Content Examples",
        items: [
          "{full_name} from {country} added {product_name} to cart",
          "{first_name} added {product_name} to cart",
          "Timestamp: {time} {unit} ago",
        ],
      },
    ],
  },
  {
    key: "review",
    title: "6) Review Notification",
    summary:
      "Review popup highlights customer review activity with review-specific token support.",
    groups: [
      {
        key: "review-content",
        title: "Content Fields",
        fields: [
          {
            name: "design.reviewType",
            description: "review_content or new_review mode.",
          },
          {
            name: "content.message",
            description: "Main review message template with tokens.",
          },
          {
            name: "content.timestamp",
            description: "Review time label (usually review_date token).",
          },
          {
            name: "productNameMode, productNameLimit",
            description: "Product title display behavior.",
          },
        ],
      },
      {
        key: "review-data",
        title: "Data Fields",
        fields: [
          {
            name: "data.dataSource",
            description: "judge_me or csv source.",
          },
          {
            name: "data.directProductPage",
            description: "Click-through to product page.",
          },
          {
            name: "data.showProductImage, data.showPriceTag, data.showRating",
            description: "Visual block toggles.",
          },
          {
            name: "selectedProducts, selectedCollections",
            description: "Scope target lists.",
          },
        ],
      },
      {
        key: "review-display",
        title: "Display Fields",
        fields: [
          {
            name: "visibility.showHome, visibility.showProduct, visibility.showCollectionList, visibility.showCollection, visibility.showCart",
            description: "Page visibility controls.",
          },
          {
            name: "visibility.productScope, visibility.collectionScope",
            description: "All vs specific scope options.",
          },
          { name: "visibility.position", description: "Popup placement." },
        ],
      },
      {
        key: "review-design-font",
        title: "Design And Font Size Fields",
        fields: [
          {
            name: "design.template, design.imageAppearance",
            description: "Template and image fit.",
          },
          {
            name: "design.bgColor, design.bgAlt, design.textColor, design.timestampColor",
            description: "Main style colors.",
          },
          {
            name: "design.priceTagBg, design.priceTagAlt, design.priceColor, design.starColor",
            description: "Price and rating accent colors.",
          },
          {
            name: "textSize.content, textSize.compareAt, textSize.price",
            description: "Font size controls in px.",
          },
        ],
      },
      {
        key: "review-behavior",
        title: "Behavior Fields",
        fields: [
          {
            name: "behavior.showClose, behavior.hideOnMobile",
            description: "Close icon and mobile hide setting.",
          },
          {
            name: "behavior.delay, behavior.duration",
            description: "Display timing controls.",
          },
          {
            name: "behavior.interval, behavior.intervalUnit, behavior.randomize",
            description: "Repeat timing behavior.",
          },
        ],
      },
      {
        key: "review-tokens",
        title: "Supported Tokens",
        items: [
          "{reviewer_name}, {review_title}, {review_body}",
          "{reviewer_country}, {reviewer_city}, {review_date}",
        ],
      },
      {
        key: "review-examples",
        title: "Ready Content Examples",
        items: [
          '{reviewer_name} - "{review_title}: {review_body}"',
          "{reviewer_name} from {reviewer_country} reviewed this product",
          "Timestamp: {review_date}",
        ],
      },
    ],
  },
];

const popupCardStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  padding: "12px",
  background: "#ffffff",
};

const groupCardStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: "10px",
  padding: "8px 10px",
  background: "#ffffff",
};

const groupBodyStyle = {
  paddingTop: "8px",
};

const accordionTitleButtonStyle = {
  width: "100%",
  border: "none",
  background: "transparent",
  padding: 0,
  margin: 0,
  cursor: "pointer",
  textAlign: "left",
};

const listStyle = {
  margin: "0 0 0 18px",
  lineHeight: "1.7",
};

const ADMIN_FIELD_LABELS = {
  messageText: "Message",
  orderDays: "Order Lookback (Days)",
  createOrderTime: "Latest Order Time",
  namesJson: "Dynamic Values / Hidden Fields",
  productNameMode: "Product Name Format",
  productNameLimit: "Product Name Limit",
  selectedProductsJson: "Selected Products",
  locationsJson: "Locations List",
  messageTitlesJson: "Message Titles List",
  enabled: "Enable Popup",
  showType: "Display On",
  showHome: "Show On Home Page",
  showProduct: "Show On Product Page",
  showCollectionList: "Show On Collection List Page",
  showCollection: "Show On Collection Page",
  showCart: "Show On Cart Page",
  position: "Desktop Position",
  mobilePosition: "Mobile Position",
  mobileSize: "Mobile Size",
  layout: "Layout",
  template: "Template",
  imageAppearance: "Image Appearance",
  fontFamily: "Font Family",
  fontWeight: "Text Weight",
  rounded: "Text Size (px)",
  bgColor: "Background Color",
  bgAlt: "Background Alt Color",
  textColor: "Text Color",
  numberColor: "Number Color",
  priceTagBg: "Price Tag Background",
  priceTagAlt: "Price Tag Alt Color",
  priceColor: "Price Color",
  starColor: "Star Color",
  animation: "Animation Style",
  firstDelaySeconds: "Initial Delay",
  durationSeconds: "Display Duration",
  alternateSeconds: "Repeat Interval",
  intervalUnit: "Interval Unit",
  messageTitle: "Headline",
  name: "Offer Title",
  iconKey: "Icon",
  iconSvg: "Uploaded SVG Icon",
  "design.notiType": "Notification Type",
  "content.message": "Message",
  "content.timestamp": "Timestamp Text",
  "content.avgTime": "Average Time Value",
  "content.avgUnit": "Average Time Unit",
  "data.directProductPage": "Open Product Page On Click",
  "data.showProductImage": "Show Product Image",
  "data.showPriceTag": "Show Price Tag",
  "data.showRating": "Show Rating",
  "data.ratingSource": "Rating Source",
  "data.customerInfo": "Customer Info Source",
  selectedDataProducts: "Selected Data Products",
  selectedVisibilityProducts: "Selected Display Products",
  selectedCollections: "Selected Collections",
  "visibility.showHome": "Show On Home Page",
  "visibility.showProduct": "Show On Product Page",
  "visibility.showCollectionList": "Show On Collection List Page",
  "visibility.showCollection": "Show On Collection Page",
  "visibility.showCart": "Show On Cart Page",
  "visibility.productScope": "Product Scope",
  "visibility.collectionScope": "Collection Scope",
  "visibility.position": "Popup Position",
  "design.layout": "Layout",
  "design.size": "Popup Size",
  "design.transparent": "Transparent Background",
  "design.template": "Template",
  "design.imageAppearance": "Image Appearance",
  "design.bgColor": "Background Color",
  "design.bgAlt": "Background Alt Color",
  "design.textColor": "Text Color",
  "design.timestampColor": "Timestamp Color",
  "design.priceTagBg": "Price Tag Background",
  "design.priceTagAlt": "Price Tag Alt Color",
  "design.priceColor": "Price Color",
  "design.starColor": "Star Color",
  "textSize.content": "Content Text Size (px)",
  "textSize.compareAt": "Compare-at Text Size (px)",
  "textSize.price": "Price Text Size (px)",
  "behavior.showClose": "Show Close Button",
  "behavior.hideOnMobile": "Hide On Mobile",
  "behavior.delay": "Initial Delay",
  "behavior.duration": "Display Duration",
  "behavior.interval": "Repeat Interval",
  "behavior.intervalUnit": "Interval Unit",
  "behavior.randomize": "Randomize Order",
  "data.dataSource": "Data Source",
  "data.stockUnder": "Low Stock Threshold",
  "data.hideOutOfStock": "Hide Out Of Stock Products",
  "design.numberColor": "Number Color",
  "design.reviewType": "Review Type",
  selectedProducts: "Selected Products",
};

function toTitleCase(value) {
  if (!value) return "";
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function humanizeFieldToken(token) {
  const cleaned = String(token || "").trim();
  if (!cleaned) return "";
  if (ADMIN_FIELD_LABELS[cleaned]) return ADMIN_FIELD_LABELS[cleaned];

  const leaf = cleaned.split(".").pop() || cleaned;
  const withoutJson = leaf.endsWith("Json") ? leaf.slice(0, -4) : leaf;
  const spaced = withoutJson
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return toTitleCase(spaced);
}

function formatAdminFieldLabel(rawName) {
  return String(rawName || "")
    .split(",")
    .map((part) => humanizeFieldToken(part))
    .filter(Boolean)
    .join(", ");
}

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

function renderFieldList(fields = []) {
  if (!fields.length) return null;
  return (
    <ul style={listStyle}>
      {fields.map((field) => (
        <li key={field.name || field.label}>
          <strong>{field.label || formatAdminFieldLabel(field.name)}:</strong>{" "}
          {field.description}
        </li>
      ))}
    </ul>
  );
}

function renderTextList(items = []) {
  if (!items.length) return null;
  return (
    <ul style={listStyle}>
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

export default function DocumentsPage() {
  const [openPopup, setOpenPopup] = useState(POPUP_DOCS[0].key);
  const [openGroups, setOpenGroups] = useState(() =>
    POPUP_DOCS.reduce((acc, popup) => {
      acc[popup.key] = popup.groups[0]?.key || null;
      return acc;
    }, {})
  );

  const togglePopup = (popupKey) => {
    setOpenPopup((prev) => (prev === popupKey ? null : popupKey));
  };

  const toggleGroup = (popupKey, groupKey) => {
    setOpenGroups((prev) => ({
      ...prev,
      [popupKey]: prev[popupKey] === groupKey ? null : groupKey,
    }));
  };

  return (
    <Page>
      <div style={{ padding: 24 }}>
        <Card>
          <BlockStack gap="500">
            <Text as="h1" variant="headingLg">
              Popup Wise Documentation
            </Text>
            {POPUP_DOCS.map((popup) => {
              const popupOpen = openPopup === popup.key;
              return (
                <div key={popup.key} style={popupCardStyle}>
                  <BlockStack gap="250">
                    <InlineStack align="space-between" blockAlign="center">
                      <button
                        type="button"
                        style={accordionTitleButtonStyle}
                        onClick={() => togglePopup(popup.key)}
                        aria-expanded={popupOpen}
                        aria-controls={`${popup.key}-content`}
                      >
                        <Text as="h3" variant="headingMd">
                          {popup.title}
                        </Text>
                      </button>
                      <Text as="span" variant="bodySm" tone="subdued">
                        {popupOpen ? "Hide" : "Show"}
                      </Text>
                    </InlineStack>

                    <Collapsible id={`${popup.key}-content`} open={popupOpen}>
                      <BlockStack gap="250">
                        <Text as="p" variant="bodyMd">
                          {popup.summary}
                        </Text>

                        {popup.groups.map((group) => {
                          const groupOpen = openGroups[popup.key] === group.key;
                          return (
                            <div
                              key={`${popup.key}-${group.key}`}
                              style={groupCardStyle}
                            >
                              <InlineStack
                                align="space-between"
                                blockAlign="center"
                              >
                                <button
                                  type="button"
                                  style={accordionTitleButtonStyle}
                                  onClick={() => toggleGroup(popup.key, group.key)}
                                  aria-expanded={groupOpen}
                                  aria-controls={`${popup.key}-${group.key}-content`}
                                >
                                  <Text as="h4" variant="headingSm">
                                    {group.title}
                                  </Text>
                                </button>
                                <Text as="span" variant="bodySm" tone="subdued">
                                  {groupOpen ? "Hide" : "Show"}
                                </Text>
                              </InlineStack>
                              <Collapsible
                                id={`${popup.key}-${group.key}-content`}
                                open={groupOpen}
                              >
                                <div style={groupBodyStyle}>
                                  {renderFieldList(group.fields)}
                                  {renderTextList(group.items)}
                                </div>
                              </Collapsible>
                            </div>
                          );
                        })}
                      </BlockStack>
                    </Collapsible>
                  </BlockStack>
                </div>
              );
            })}

            <Text as="p" variant="bodySm" tone="subdued">
              Use this page as admin setting reference while configuring
              notifications.
            </Text>
          </BlockStack>
        </Card>
      </div>
    </Page>
  );
}
