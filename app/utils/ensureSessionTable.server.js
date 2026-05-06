const CREATE_SESSION_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS \`session\` (
  \`id\` VARCHAR(255) NOT NULL,
  \`shop\` VARCHAR(255) NOT NULL,
  \`state\` VARCHAR(255) NOT NULL,
  \`isOnline\` BOOLEAN NOT NULL DEFAULT false,
  \`scope\` TEXT NULL,
  \`expires\` DATETIME(3) NULL,
  \`accessToken\` TEXT NOT NULL,
  \`userId\` BIGINT NULL,
  \`firstName\` VARCHAR(191) NULL,
  \`lastName\` VARCHAR(191) NULL,
  \`email\` VARCHAR(320) NULL,
  \`accountOwner\` BOOLEAN NOT NULL DEFAULT false,
  \`locale\` VARCHAR(20) NULL,
  \`collaborator\` BOOLEAN NULL DEFAULT false,
  \`emailVerified\` BOOLEAN NULL DEFAULT false,
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
`;

const MAX_RETRIES = 3;

// Module-level flag: once the table is verified in this process, skip future checks.
// In serverless (Lambda), each instance checks once then reuses the flag.
let sessionTableReady = false;

function isConnectionLimitError(err) {
  const msg = err?.message || err?.cause?.message || "";
  return msg.includes("max_user_connections") || msg.includes("1203");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runTableCheck(prismaClient) {
  const existingTables = await prismaClient.$queryRaw`
    SELECT table_name AS tableName
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name IN ('session', 'Session')
  `;

  const tableNames = new Set(
    existingTables.map((row) => String(row.tableName || ""))
  );

  const hasLowercaseTable = tableNames.has("session");
  const hasUppercaseTable = tableNames.has("Session");

  if (!hasLowercaseTable && hasUppercaseTable) {
    await prismaClient.$executeRawUnsafe("RENAME TABLE `Session` TO `session`");
    return;
  }

  if (!hasLowercaseTable) {
    await prismaClient.$executeRawUnsafe(CREATE_SESSION_TABLE_SQL);
  }
}

export async function ensurePrismaSessionTable(prismaClient) {
  if (sessionTableReady) return;

  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(400 * attempt);
    }
    try {
      await runTableCheck(prismaClient);
      sessionTableReady = true;
      return;
    } catch (error) {
      // Connection-limit errors won't resolve with retries — fail fast to avoid
      // compounding the connection count on an already-saturated DB user.
      if (isConnectionLimitError(error)) {
        // Connections are saturated, which means the app is already running —
        // the session table must already exist. Mark ready to stop the cascade
        // where each retry opens another connection and makes things worse.
        console.warn(
          "[SessionTable] DB connections saturated — assuming session table exists and marking ready.",
          error?.message || error
        );
        sessionTableReady = true;
        return;
      }
      if (attempt < MAX_RETRIES - 1) {
        lastError = error;
        continue;
      }
      throw new Error(
        "Failed to prepare Prisma session table. Run `prisma migrate deploy` or grant CREATE/RENAME permissions.",
        { cause: error }
      );
    }
  }
  throw new Error(
    "Failed to prepare Prisma session table. Run `prisma migrate deploy` or grant CREATE/RENAME permissions.",
    { cause: lastError }
  );
}
