import { json } from "@remix-run/node";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import { useEffect } from "react";

export const loader = async () => {
  const apiKey =
    process.env.SHOPIFY_API_KEY ||
    process.env.SHOPIFY_APP_BRIDGE_APP_ID ||
    "";
  return json({ apiKey });
};

export default function App() {
  const { apiKey } = useLoaderData();

  useEffect(() => {
    const remove = () =>
      document.documentElement.classList.remove("no-anim");

    if ("requestAnimationFrame" in window) {
      window.requestAnimationFrame(() => remove());
    } else {
      setTimeout(remove, 0);
    }
  }, []);

  return (
    <html className="no-anim" lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1"
        />

        {/* Shopify App Bridge */}
        {apiKey ? (
          <>
            <meta name="shopify-api-key" content={apiKey} />
            <script
              src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
              data-api-key={apiKey}
            />
          </>
        ) : null}

        {/* Disable animations on first load */}
        <style>{`
          html.no-anim *, 
          html.no-anim *::before, 
          html.no-anim *::after {
            animation: none !important;
            transition: none !important;
          }
        `}</style>

        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />

        <Meta />
        <Links />

        {/* ✅ Tawk.to Live Chat – Backend (All Pages) */}
        {/* <script
          dangerouslySetInnerHTML={{
            __html: `
              var Tawk_API = Tawk_API || {}, Tawk_LoadStart = new Date();
              (function () {
                var s1 = document.createElement("script"),
                    s0 = document.getElementsByTagName("script")[0];
                s1.async = true;
                s1.src = "https://embed.tawk.to/6978a35b3f0a47198127c8ed/1jfvjs7l0";
                s1.charset = "UTF-8";
                s1.setAttribute("crossorigin", "*");
                s0.parentNode.insertBefore(s1, s0);
              })();
            `,
          }}
        /> */}
      </head>

      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error?.message || "Something went wrong";

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Application Error</title>
        <Meta />
        <Links />
      </head>
      <body>
        <div style={{ padding: 24, fontFamily: "Inter, sans-serif" }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Application Error</h1>
          <p style={{ color: "#6b7280" }}>{message}</p>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
