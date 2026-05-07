// app/routes/app.notification.$key.edit.$id.jsx
import { useParams } from "@remix-run/react";
import AddToCartPopupPage from "./app.notification.addtocart";
import FlashConfigPage from "./app.notification.flash";
import LowStockPopupPage from "./app.notification.lowstock";
import RecentOrdersPopupPage from "./app.notification.recent";
import ReviewNotificationPage from "./app.notification.review";
import VisitorPopupPage from "./app.notification.visitor";

const COMPONENTS = {
  recent: RecentOrdersPopupPage,
  flash: FlashConfigPage,
  visitor: VisitorPopupPage,
  lowstock: LowStockPopupPage,
  addtocart: AddToCartPopupPage,
  review: ReviewNotificationPage,
};

const getKey = (params) => {
  const key = String(params?.key || "").toLowerCase();
  if (!COMPONENTS[key]) {
    throw new Response("Not Found", { status: 404 });
  }
  return key;
};

const loadEditorModule = async (key) => {
  switch (key) {
    case "recent":
      return import("./app.notification.recent");
    case "flash":
      return import("./app.notification.flash");
    case "visitor":
      return import("./app.notification.visitor");
    case "lowstock":
      return import("./app.notification.lowstock");
    case "addtocart":
      return import("./app.notification.addtocart");
    case "review":
      return import("./app.notification.review");
    default:
      throw new Response("Not Found", { status: 404 });
  }
};

const requestWithEditId = (request, params) => {
  const url = new URL(request.url);
  const id = Number(params?.id);
  if (Number.isInteger(id) && id > 0) {
    url.searchParams.set("editId", String(id));
  }
  url.searchParams.set("mode", "edit");
  return new Request(url, request);
};

export const loader = async ({ request, params }) => {
  const editor = await loadEditorModule(getKey(params));
  return editor.loader({ request: requestWithEditId(request, params), params });
};

export const action = async ({ request, params }) => {
  const editor = await loadEditorModule(getKey(params));
  return editor.action({ request: requestWithEditId(request, params), params });
};

export default function EditRoute() {
  const params = useParams();
  const key = String(params?.key || "").toLowerCase();
  const Component = COMPONENTS[key];
  if (!Component) return null;
  return <Component />;
}
