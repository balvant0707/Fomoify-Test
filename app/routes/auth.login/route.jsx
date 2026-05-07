import { login } from "../../shopify.server";

export const loader = async ({ request }) => {
  return login(request);
};

export const action = async ({ request }) => {
  return login(request);
};

export default function AuthLogin() {
  return null;
}
