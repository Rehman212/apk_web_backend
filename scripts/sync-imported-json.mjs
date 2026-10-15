import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const file = process.argv[2] || "D:/apk_web/data/imported-apps.json";

async function main() {
  const raw = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(raw)) throw new Error("JSON must be an array");

  let saved = 0;
  for (const app of raw) {
    if (!app?.name || !app?.packageName || !app?.slug) continue;
    const data = {
      slug: String(app.slug),
      name: String(app.name),
      packageName: String(app.packageName),
      developer: String(app.developer || "Unknown"),
      kind: String(app.kind || "app"),
      category: String(app.category || "tools"),
      version: String(app.version || "1.0.0"),
      size: String(app.size || "—"),
      apkUrl: app.apkUrl ? String(app.apkUrl) : null,
      iconUrl: app.iconUrl ? String(app.iconUrl) : null,
      short: String(app.short || ""),
      description: String(app.description || ""),
      requires: String(app.requires || "Android 8.0+"),
      accent: String(app.accent || "#2f7bff"),
      letter: String(app.letter || app.name).slice(0, 2).toUpperCase(),
      payload: app,
    };
    await prisma.apk.upsert({
      where: { packageName: data.packageName },
      create: data,
      update: data,
    });
    saved += 1;
    if (saved % 25 === 0) console.log(`Saved ${saved}/${raw.length}`);
  }
  console.log(`Done. Synced ${saved} APKs into database.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
