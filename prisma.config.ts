import "dotenv/config";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { defineConfig } = require("prisma/config");
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    // `prisma db push`/`db seed` require a non-empty url even when a driver adapter
    // is also provided (the actual connection goes through the adapter below) — fall
    // back to building one from the individual DATABASE_* vars so this doesn't need
    // its own separately-maintained env var on every host.
    url:
      process.env.DATABASE_URL ||
      `mysql://${process.env.DATABASE_USER || "root"}:${encodeURIComponent(process.env.DATABASE_PASSWORD || "")}@${process.env.DATABASE_HOST || "127.0.0.1"}:${process.env.DATABASE_PORT || 3306}/${process.env.DATABASE_NAME || "aftersales_db"}`,
    adapter: () => {
      return new PrismaMariaDb({
        host: process.env.DATABASE_HOST || "127.0.0.1",
        port: Number(process.env.DATABASE_PORT) || 3306,
        user: process.env.DATABASE_USER || "root",
        password: process.env.DATABASE_PASSWORD || "",
        database: process.env.DATABASE_NAME || "aftersales_db",
        connectionLimit: 5,
        // Real MySQL 8 servers (Railway's included) default to caching_sha2_password,
        // which needs this to exchange the RSA key without a TLS connection.
        allowPublicKeyRetrieval: true,
      });
    },
  },
});
