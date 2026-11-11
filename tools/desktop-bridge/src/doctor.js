try {
  await import("@nut-tree-fork/nut-js");
  console.log("nut-js: ok");
} catch (err) {
  console.error("nut-js missing — run npm install in tools/desktop-bridge");
  console.error(String(err?.message || err));
  process.exit(1);
}
