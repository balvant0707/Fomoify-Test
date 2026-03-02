import { json } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";
import {
  BlockStack,
  Box,
  Button,
  Card,
  Frame,
  InlineStack,
  Link as PolarisLink,
  Modal,
  Page,
  Text,
  TextField,
  Toast,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const INTEGRATION_KEY = "integration_judge_me";
const JUDGE_ME_APP_URL = "https://apps.shopify.com/judgeme";
const JUDGE_ME_VERIFY_URL = "https://judge.me/api/v1/reviews";

const normalizeShopDomain = (shop = "") =>
  String(shop || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

const pickJudgeMeErrorMessage = (payload) => {
  if (!payload || typeof payload !== "object") return "";

  const candidates = [
    payload.error,
    payload.message,
    payload.errors,
    payload.error_message,
    payload.errorMessage,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
    if (Array.isArray(candidate) && candidate.length) {
      const first = candidate[0];
      if (typeof first === "string" && first.trim()) return first.trim();
      if (first && typeof first === "object") {
        const nested =
          first.message || first.error || first.detail || first.title || "";
        if (typeof nested === "string" && nested.trim()) return nested.trim();
      }
    }
  }

  return "";
};

const isJudgeMeCredentialError = (status, message = "") => {
  const lower = String(message || "").toLowerCase();
  if (status === 401 || status === 403) return true;
  if (status === 400 || status === 422) {
    return (
      lower.includes("api") ||
      lower.includes("token") ||
      lower.includes("auth") ||
      lower.includes("unauthorized") ||
      lower.includes("forbidden") ||
      lower.includes("shop_domain") ||
      lower.includes("shop domain")
    );
  }
  return (
    lower.includes("invalid api") ||
    lower.includes("api token") ||
    lower.includes("private api") ||
    lower.includes("unauthorized") ||
    lower.includes("forbidden")
  );
};

async function verifyJudgeMeApiKey({ shop, apiKey }) {
  const shopDomain = normalizeShopDomain(shop);

  const params = new URLSearchParams({
    api_token: apiKey,
    shop_domain: shopDomain,
    per_page: "1",
    page: "1",
  });

  const response = await fetch(`${JUDGE_ME_VERIFY_URL}?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const contentType = String(response.headers.get("content-type") || "");
  let payload = null;
  let fallbackText = "";

  if (contentType.toLowerCase().includes("application/json")) {
    payload = await response.json().catch(() => null);
  } else {
    fallbackText = await response.text().catch(() => "");
    try {
      payload = fallbackText ? JSON.parse(fallbackText) : null;
    } catch {
      payload = null;
    }
  }

  const judgeMeMessage = pickJudgeMeErrorMessage(payload) || fallbackText;

  if (!response.ok) {
    if (isJudgeMeCredentialError(response.status, judgeMeMessage)) {
      return {
        ok: false,
        fieldError:
          "Invalid Judge.me Private API Key for this Shopify domain.",
      };
    }

    return {
      ok: false,
      error:
        judgeMeMessage ||
        `Judge.me verification failed with status ${response.status}.`,
    };
  }

  return { ok: true };
}

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session?.shop || "";

  let apiKey = "";
  try {
    const model = prisma?.notificationconfig || null;
    if (shop && model?.findFirst) {
      const row = await model.findFirst({
        where: { shop, key: INTEGRATION_KEY },
        orderBy: { id: "desc" },
      });
      apiKey = row?.messageText ? String(row.messageText) : "";
    }
  } catch (error) {
    console.warn("[Integrations] loader fetch failed:", error);
  }

  return json({
    shop,
    apiKey,
  });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session?.shop || "";
  if (!shop) {
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const intent = String(form.get("_action") || "")
    .trim()
    .toLowerCase();
  const apiKey = String(form.get("apiKey") || "").trim();

  if (intent !== "connect" && intent !== "disconnect") {
    return json({ ok: false, error: "Invalid action." }, { status: 400 });
  }

  try {
    const model = prisma?.notificationconfig || null;
    if (!model?.findFirst || !model?.create) {
      throw new Error("Integration storage model is unavailable");
    }

    const existing = await model.findFirst({
      where: { shop, key: INTEGRATION_KEY },
      orderBy: { id: "desc" },
    });

    if (intent === "disconnect") {
      if (existing?.id && model?.update) {
        await model.update({
          where: { id: existing.id },
          data: { enabled: false, messageText: "" },
        });
      }
      return json({ ok: true, disconnected: true, message: "Disconnected." });
    }

    if (!apiKey) {
      return json(
        {
          ok: false,
          fieldErrors: { apiKey: "Private API Key is required." },
        },
        { status: 400 }
      );
    }

    const verification = await verifyJudgeMeApiKey({ shop, apiKey });
    if (!verification.ok) {
      if (verification.fieldError) {
        return json(
          {
            ok: false,
            fieldErrors: { apiKey: verification.fieldError },
          },
          { status: 400 }
        );
      }

      return json(
        {
          ok: false,
          error:
            verification.error || "Unable to verify Judge.me Private API Key.",
        },
        { status: 502 }
      );
    }

    if (existing?.id && model?.update) {
      await model.update({
        where: { id: existing.id },
        data: { enabled: true, messageText: apiKey },
      });
    } else {
      await model.create({
        data: {
          shop,
          key: INTEGRATION_KEY,
          enabled: true,
          showType: "integration",
          messageText: apiKey,
        },
      });
    }

    return json({
      ok: true,
      connected: true,
      apiKey,
      message: "Connect successfully",
    });
  } catch (error) {
    console.error("[Integrations] save failed:", error);
    return json(
      { ok: false, error: error?.message || "Failed to connect Judge.me." },
      { status: 500 }
    );
  }
};

function JudgeMeBadge() {
  return (
    <div
      style={{
        width: 84,
        height: 84,
        borderRadius: 14,
        background: "linear-gradient(135deg, #0E8B8B 0%, #4AB7A4 100%)",
        color: "#ffffff",
        display: "grid",
        placeItems: "center",
        fontSize: 54,
        fontWeight: 700,
      }}
      aria-hidden
    >
      J
    </div>
  );
}

export default function IntegrationsPage() {
  const { shop, apiKey: savedApiKey } = useLoaderData();
  const fetcher = useFetcher();
  const [apiKey, setApiKey] = useState(savedApiKey || "");
  const [apiKeyError, setApiKeyError] = useState("");
  const [isConnected, setIsConnected] = useState(Boolean(savedApiKey));
  const [toast, setToast] = useState({ active: false, error: false, msg: "" });
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  const saving = fetcher.state !== "idle";

  useEffect(() => {
    if (!fetcher.data) return;
    if (fetcher.data.ok) {
      setApiKeyError("");
      if (fetcher.data.disconnected) {
        setIsConnected(false);
        setApiKey("");
        return;
      }
      if (fetcher.data.connected) {
        setIsConnected(true);
        if (typeof fetcher.data.apiKey === "string") {
          setApiKey(fetcher.data.apiKey);
        }
      }
      return;
    }

    const nextApiKeyError = String(fetcher.data?.fieldErrors?.apiKey || "");
    setApiKeyError(nextApiKeyError);
    if (nextApiKeyError) return;

    setToast({
      active: true,
      error: true,
      msg: fetcher.data.error || "Unable to save integration.",
    });
  }, [fetcher.data]);

  return (
    <Frame>
      <Page title="Integrations">
        <Card>
          <Box>
            <fetcher.Form method="post">
              <input
                type="hidden"
                name="_action"
                value={isConnected ? "disconnect" : "connect"}
              />
              <BlockStack gap="500">
                <InlineStack align="space-between" blockAlign="start">
                  <InlineStack gap="400" blockAlign="center">
                    <JudgeMeBadge />
                    <BlockStack gap="100">
                      <Text as="h2" variant="headingLg">
                        <PolarisLink
                          removeUnderline
                          url={JUDGE_ME_APP_URL}
                          external
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Judge.me Product Reviews
                        </PolarisLink>
                      </Text>
                      <Text tone="subdued" as="p">
                        Build trust with unlimited product reviews, photos and
                        videos.
                      </Text>
                    </BlockStack>
                  </InlineStack>
                </InlineStack>

                <TextField
                  label="Shopify domain"
                  value={shop}
                  autoComplete="off"
                  readOnly
                  helpText="We automatic detect your shopify domain"
                />

                <BlockStack gap="200">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="p" variant="bodyMd">
                      Private API Key
                    </Text>
                    <Button
                      variant="plain"
                      onClick={() => setHelpModalOpen(true)}
                    >
                      How to get API token
                    </Button>
                  </InlineStack>
                  <TextField
                    name="apiKey"
                    value={apiKey}
                    onChange={(value) => {
                      setApiKey(value);
                      if (apiKeyError) setApiKeyError("");
                    }}
                    autoComplete="off"
                    error={apiKeyError || undefined}
                  />
                </BlockStack>

                {isConnected ? (
                  <InlineStack align="space-between" blockAlign="center">
                    <Text
                      as="span"
                      style={{
                        background: "#b7f5cb",
                        color: "#095236",
                        borderRadius: 10,
                        padding: "8px 12px",
                        fontWeight: 600,
                      }}
                    >
                      Connect successfully
                    </Text>
                    <Button
                      submit
                      tone="critical"
                      variant="secondary"
                      loading={saving}
                    >
                      Disconnect
                    </Button>
                  </InlineStack>
                ) : (
                  <InlineStack align="end">
                    <Button submit variant="primary" loading={saving}>
                      Connect
                    </Button>
                  </InlineStack>
                )}
              </BlockStack>
            </fetcher.Form>
          </Box>
        </Card>
      </Page>
      <Modal
        open={helpModalOpen}
        onClose={() => setHelpModalOpen(false)}
        title="How to Integrate with Judge.me to show review notification"
        primaryAction={{
          content: "Close",
          onAction: () => setHelpModalOpen(false),
        }}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <BlockStack gap="100">
              <Text as="h3" variant="headingSm">
                Why integrate with{" "}
                <PolarisLink
                  url={JUDGE_ME_APP_URL}
                  external
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Judge.me
                </PolarisLink>
              </Text>
              <Text as="p">
                <PolarisLink
                  url={JUDGE_ME_APP_URL}
                  external
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Judge.me
                </PolarisLink>{" "}
                is the most popular review app on Shopify with proven records
                of good value to Shopify merchants. SnapNoti decided to serve
                our users better by integrating with this application, to show
                your product review on our notification, creating stronger
                social proof.
              </Text>
            </BlockStack>

            <BlockStack gap="100">
              <Text as="h3" variant="headingSm">
                How to get{" "}
                <PolarisLink
                  url={JUDGE_ME_APP_URL}
                  external
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Judge.me
                </PolarisLink>{" "}
                API key:
              </Text>
              <Text as="p" fontWeight="semibold">
                Step 1: Install{" "}
                <PolarisLink
                  url={JUDGE_ME_APP_URL}
                  external
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Judge.me
                </PolarisLink>
              </Text>
              <Text as="p">
                You must install{" "}
                <PolarisLink
                  url={JUDGE_ME_APP_URL}
                  external
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Judge.me
                </PolarisLink>{" "}
                on your store to use this feature.{" "}
                <PolarisLink
                  url={JUDGE_ME_APP_URL}
                  external
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Install Judge.me.
                </PolarisLink>
              </Text>
            </BlockStack>

            <BlockStack gap="100">
              <Text as="p" fontWeight="semibold">
                Step 2: Configure{" "}
                <PolarisLink
                  url={JUDGE_ME_APP_URL}
                  external
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Judge.me
                </PolarisLink>{" "}
                API
              </Text>
              <Text as="p">
                From{" "}
                <PolarisLink
                  url={JUDGE_ME_APP_URL}
                  external
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Judge.me
                </PolarisLink>{" "}
                admin, go to General Settings &gt; Integrations &gt; View API
                token.
              </Text>
              <Text as="p">Copy the Shop domain and Private token.</Text>
            </BlockStack>

            <BlockStack gap="100">
              <Text as="p" fontWeight="semibold">
                Step 3: Integrate with SnapNoti
              </Text>
              <Text as="p">
                In "Integration" tab, choose{" "}
                <PolarisLink
                  url={JUDGE_ME_APP_URL}
                  external
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Judge.me
                </PolarisLink>
                .
              </Text>
              <Text as="p">Copy the API token to the field.</Text>
              <Text as="p">Click "Connect" and wait for the result.</Text>
            </BlockStack>

            <BlockStack gap="100">
              <Text as="p" fontWeight="semibold">
                Step 4: Set up review notification
              </Text>
              <Text as="p">
                Once done, you can go to Notification page, choose "Review
                notification" and start configure.
              </Text>
              <Text as="p">
                In Data tab of the Settings panel, choose "Sync{" "}
                <PolarisLink
                  url={JUDGE_ME_APP_URL}
                  external
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Judge.me
                </PolarisLink>{" "}
                review" to get review data from{" "}
                <PolarisLink
                  url={JUDGE_ME_APP_URL}
                  external
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Judge.me
                </PolarisLink>
                .
              </Text>
            </BlockStack>

            <BlockStack gap="100">
              <Text as="p" fontWeight="semibold">
                Step 5: Activate the review notification
              </Text>
              <Text as="p">
                Make sure to enable the Snap Noti app-embed to see the
                notification with review on storefront.
              </Text>
            </BlockStack>
          </BlockStack>
        </Modal.Section>
      </Modal>
      {toast.active ? (
        <Toast
          content={toast.msg}
          error={toast.error}
          onDismiss={() => setToast((prev) => ({ ...prev, active: false }))}
          duration={4000}
        />
      ) : null}
    </Frame>
  );
}
