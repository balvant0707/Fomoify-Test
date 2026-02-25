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

export async function ensurePrismaSessionTable(prismaClient) {
  try {
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
      await prismaClient.$executeRawUnsafe(
        "RENAME TABLE `Session` TO `session`"
      );
      return;
    }

    if (!hasLowercaseTable) {
      await prismaClient.$executeRawUnsafe(CREATE_SESSION_TABLE_SQL);
    }
  } catch (error) {
    throw new Error(
      "Failed to prepare Prisma session table. Run `prisma migrate deploy` or grant CREATE/RENAME permissions.",
      { cause: error }
    );
  }
}
