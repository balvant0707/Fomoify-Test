// server.cjs — Remix + Express (CJS) for Windows/IIS (Plesk)
try {
  require("dotenv").config();
} catch {}

const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const express = require("express");

// ---- Optional middlewares (safe import) ----
let compressionMw = (_r, _s, next) => next();
try {
  compressionMw = require("compression")();
} catch {}

let morganMw = (_r, _s, next) => next();
try {
  morganMw = require("morgan")("tiny");
} catch {}

let createRequestHandler = null;
try {
  createRequestHandler = require("@remix-run/express").createRequestHandler;
} catch {}

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true);

// -----------------------------------------------------
// 🔍 Health / Debug / Ping
// -----------------------------------------------------
app.get("/healthz", (_req, res) => res.status(200).send("OK"));
app.get("/ping", (_req, res) => res.type("text").send("pong"));
app.get("/debug-env", (_req, res) => {
  res.status(200).json({
    NODE_ENV: process.env.NODE_ENV || "production",
    SHOPIFY_APP_URL:
      process.env.SHOPIFY_APP_URL || "https://fomoapp.smartreminder.in",
    APP_URL: process.env.APP_URL || "https://fomoapp.smartreminder.in",
    PORT_PRESENT: Boolean(process.env.PORT),
    DB_URL_PRESENT: Boolean(process.env.DATABASE_URL),
  });
});

// -----------------------------------------------------
// 📁 Static assets
// -----------------------------------------------------
const appRoot = __dirname;

// /public first
const publicDir = path.join(appRoot, "public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir, { maxAge: "1h" }));
}

// mount ALL build dirs at /build (falls through if not found)
["public/build", "build/client", "build"].forEach((rel) => {
  const full = path.join(appRoot, rel);
  if (fs.existsSync(full)) {
    app.use("/build", express.static(full, { immutable: true, maxAge: "1y" }));
  }
});
// -----------------------------------------------------
let polarisCssPath = null;
try {
  polarisCssPath = require.resolve("@shopify/polaris/build/esm/styles.css");
} catch (e) {
  console.error("Polaris CSS not found. Install @shopify/polaris.", e);
}
function sendPolarisCss(_req, res) {
  if (!polarisCssPath) return res.status(404).send("polaris.css not found");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.type("text/css");
  res.sendFile(polarisCssPath);
}
app.get("/polaris.css", sendPolarisCss);
// direct aliases for your failing paths
app.get("/assets/styles-:hash.css", sendPolarisCss);
app.get("/build/assets/styles-:hash.css", sendPolarisCss);

const ASSET_SEARCH_DIRS = [
  path.join(appRoot, "public", "build", "assets"),
  path.join(appRoot, "build", "client", "assets"),
  path.join(appRoot, "build", "assets"),
  path.join(appRoot, "build", "server", "assets"), // last resort
];

function findAsset(assetRelName) {
  // basic sanitization (filenames like components-*.js, styles-*.css)
  if (!/^[A-Za-z0-9._\-\/]+$/.test(assetRelName)) return null;

  for (const base of ASSET_SEARCH_DIRS) {
    const abs = path.join(base, assetRelName);
    if (abs.startsWith(base) && fs.existsSync(abs)) return abs;
  }
  return null;
}

function assetHandler(req, res) {
  const name = req.params.file || "";
  const found = findAsset(name);

  if (found) {
    const ext = path.extname(found).toLowerCase();
    if (ext === ".css") res.type("text/css");
    if (ext === ".js") res.type("application/javascript");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.sendFile(found);
  }

  // final fallback: if it *looks* like the main styles-*.css, send Polaris CSS
  if (/^styles-.*\.css$/i.test(path.basename(name)))
    return sendPolarisCss(req, res);

  return res.status(404).send("asset not found");
}

// wildcard routes
app.get("/build/assets/:file(*)", assetHandler);
app.get("/build/_assets/:file(*)", assetHandler);
app.get("/assets/:file(*)", assetHandler);

// -----------------------------------------------------
// (Optional) auto-inject Polaris CSS link into HTML
// -----------------------------------------------------
app.use((req, res, next) => {
  const oldSend = res.send;
  res.send = function (body) {
    try {
      if (
        typeof body === "string" &&
        body.includes("</head>") &&
        !body.includes("/polaris.css")
      ) {
        body = body.replace(
          "</head>",
          '<link rel="stylesheet" href="/polaris.css"></head>'
        );
      }
    } catch {}
    return oldSend.call(this, body);
  };
  next();
});

// -----------------------------------------------------
// 🧩 Middlewares
// -----------------------------------------------------
app.use(compressionMw);
app.use(morganMw);

// -----------------------------------------------------
// ⚙️ Load Remix server build (supports CJS or ESM)
// -----------------------------------------------------
const BUILD_CANDIDATES = [
  path.join(appRoot, "build", "server", "index.cjs"), // CJS build
  path.join(appRoot, "build", "server", "index.js"), // may be ESM with remix vite:build
];

let BUILD_PATH = BUILD_CANDIDATES.find((p) => fs.existsSync(p));
let BUILD = null,
  buildErr = null,
  buildExists = Boolean(BUILD_PATH);

async function loadBuild() {
  if (!buildExists) return null;

  // ✅ CJS -> require
  if (BUILD_PATH.endsWith(".cjs")) {
    const mod = require(BUILD_PATH);
    return mod && mod.default ? mod.default : mod;
  }

  // ✅ .js may be ESM -> dynamic import(fileUrl)
  const fileUrl = pathToFileURL(BUILD_PATH).href;
  const mod = await import(fileUrl);
  return mod && mod.default ? mod.default : mod;
}

// tiny helper for __fs
const dirList = (p) => {
  try {
    return fs.readdirSync(p);
  } catch {
    return "(cannot read)";
  }
};

// probes
app.get("/__build", (_req, res) => {
  res.status(200).json({
    buildExists,
    loaded: !!BUILD,
    BUILD_PATH: BUILD_PATH || "(not found)",
    error: buildErr ? String(buildErr.stack || buildErr) : null,
  });
});

app.get("/__fs", (_req, res) => {
  const root = __dirname;
  res.status(200).json({
    root,
    exists: {
      "build/": fs.existsSync(path.join(root, "build")),
      "build/server/": fs.existsSync(path.join(root, "build", "server")),
      "build/server/index.cjs": fs.existsSync(
        path.join(root, "build", "server", "index.cjs")
      ),
      "build/server/index.js": fs.existsSync(
        path.join(root, "build", "server", "index.js")
      ),
      "public/build/": fs.existsSync(path.join(root, "public", "build")),
      "node_modules/": fs.existsSync(path.join(root, "node_modules")),
    },
    list: {
      "build/": dirList(path.join(root, "build")),
      "build/server/": dirList(path.join(root, "build", "server")),
      "public/build/": dirList(path.join(root, "public", "build")),
    },
  });
});

// -----------------------------------------------------
// 🚦 Remix handler / fallback (async build loader)
// -----------------------------------------------------
(async () => {
  try {
    BUILD = await loadBuild();
  } catch (e) {
    buildErr = e;
  }

  if (BUILD && createRequestHandler) {
    app.all(
      "*",
      createRequestHandler({
        build: BUILD,
        mode: process.env.NODE_ENV || "production",
      })
    );
  } else {
    app.all("*", (_req, res) => {
      const msg = [
        "❌ Remix server build not available.",
        "",
        "Tried:",
        ...BUILD_CANDIDATES.map((p) => ` - ${p}`),
        "",
        `Chosen BUILD_PATH: ${BUILD_PATH || "(none found)"}`,
        "",
        "Detail:",
        buildErr ? String(buildErr.stack || buildErr) : "(no stack)",
      ].join("\n");
      res.status(500).type("text/plain").send(msg);
    });
  }
})();

// -----------------------------------------------------
// ⚠️ Error visibility
// -----------------------------------------------------
process.on("unhandledRejection", (err) =>
  console.error("UNHANDLED REJECTION", err)
);
process.on("uncaughtException", (err) =>
  console.error("UNCAUGHT EXCEPTION", err)
);

// -----------------------------------------------------
// 🚀 Start
// -----------------------------------------------------
const port = process.env.PORT || 3000; // ✅ Vercel-safe fallback
app.listen(port, () => console.log(`✅ Server listening on port ${port}`));

