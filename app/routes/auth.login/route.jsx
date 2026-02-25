// import { useState } from "react";
// import { Form, useActionData, useLoaderData } from "@remix-run/react";
// import {
//   AppProvider as PolarisAppProvider,
//   Button,
//   Card,
//   FormLayout,
//   Page,
//   Text,
//   TextField,
// } from "@shopify/polaris";
// import polarisTranslations from "@shopify/polaris/locales/en.json";
// import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
// import { login } from "../../shopify.server";
// import { loginErrorMessage } from "./error.server";
//
// export const links = () => [{ rel: "stylesheet", href: polarisStyles }];
//
// export const loader = async ({ request }) => {
//   const errors = loginErrorMessage(await login(request));
//
//   return { errors, polarisTranslations };
// };
//
// export const action = async ({ request }) => {
//   const errors = loginErrorMessage(await login(request));
//
//   return {
//     errors,
//   };
// };
//
// export default function Auth() {
//   const loaderData = useLoaderData();
//   const actionData = useActionData();
//   const [shop, setShop] = useState("");
//   const { errors } = actionData || loaderData;
//
//   return (
//     <PolarisAppProvider i18n={loaderData.polarisTranslations}>
//       <Page>
//         <Card>
//           <Form method="post">
//             <FormLayout>
//               <Text variant="headingMd" as="h2">
//                 Log in
//               </Text>
//               <TextField
//                 type="text"
//                 name="shop"
//                 label="Shop domain"
//                 helpText="example.myshopify.com"
//                 value={shop}
//                 onChange={setShop}
//                 autoComplete="on"
//                 error={errors.shop}
//               />
//               <Button submit>Log in</Button>
//             </FormLayout>
//           </Form>
//         </Card>
//       </Page>
//     </PolarisAppProvider>
//   );
// }
// app/routes/auth.login/route.jsx
import { redirect } from "@remix-run/node";
import { authenticate } from "../../shopify.server";

// Loader: Shopify helper redirect use àª•àª°à«‹ àªœà«‡àª¥à«€ context (host, shop) preserve àª°àª¹à«‡
export const loader = async ({ request }) => {
  const result = await authenticate.admin(request);
  if (result instanceof Response) return result;

  const url = new URL(request.url);
  return redirect(`/app${url.search}`);
};

// (optional safety) àªœà«‹ POST àª¥àªˆ àªœàª¾àª¯ àª¤à«‹ àªªàª£ àª àªœ àª°à«€àª¤à«‡ redirect àª•àª°à«‹
export const action = async ({ request }) => {
  const result = await authenticate.admin(request);
  if (result instanceof Response) return result;

  const url = new URL(request.url);
  return redirect(`/app${url.search}`);
};

export default function AuthLogin() {
  return null; // àª•à«‹àªˆ UI àª¨àª¹à«€àª‚
}
