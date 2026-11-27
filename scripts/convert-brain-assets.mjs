import sharp from "sharp";
import fs from "fs";
import path from "path";

const store =
  "C:/Users/Next/AppData/Local/Cursor/AgentStores/cursor_agent_stores/bc-b615ec6b-a050-4577-b112-24387e3737d3/files";
const media = path.join(store, "media");
const pub = path.join(process.cwd(), "public");

const logoJpg = path.join(media, "testlineqi-brain-logo.jpg");
const iconJpg = path.join(media, "testlineqi-brain-icon.jpg");

fs.copyFileSync(logoJpg, path.join(pub, "testlineqi-brain-logo.jpg"));
fs.copyFileSync(iconJpg, path.join(pub, "testlineqi-brain-icon.jpg"));

await sharp(logoJpg).png().toFile(path.join(pub, "testlineqi-brain-logo.png"));
await sharp(iconJpg).png().toFile(path.join(pub, "testlineqi-brain-icon.png"));

await sharp(iconJpg)
  .resize(1080, 1080, { fit: "cover", position: "centre" })
  .png()
  .toFile(path.join(pub, "logo-tiktok-perfil.png"));

await sharp(iconJpg)
  .resize(1080, 1080, { fit: "cover", position: "centre" })
  .jpeg({ quality: 92 })
  .toFile(path.join(pub, "logo-tiktok-perfil.jpg"));

await sharp(logoJpg).png().toFile(path.join(pub, "testlineqi-logo.png"));
await sharp(logoJpg).jpeg({ quality: 92 }).toFile(path.join(pub, "testlineqi-logo.jpg"));

for (const f of [
  "testlineqi-brain-logo.png",
  "testlineqi-brain-icon.png",
  "logo-tiktok-perfil.png",
  "testlineqi-logo.png",
]) {
  fs.copyFileSync(path.join(pub, f), path.join(media, f));
}

for (const f of [
  "testlineqi-brain-logo.png",
  "testlineqi-brain-icon.png",
  "logo-tiktok-perfil.png",
  "testlineqi-logo.png",
]) {
  const m = await sharp(path.join(pub, f)).metadata();
  console.log(`${f} ${m.width}x${m.height}`);
}
