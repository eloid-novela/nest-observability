// Builds every package and writes installable tarballs to ./.packs, so the
// packages can be tried in another project before they are published.
import { execSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = resolve(root, ".packs");

rmSync(out, { recursive: true, force: true });
mkdirSync(out);

execSync("npm run build", { cwd: root, stdio: "inherit" });
execSync(`npm pack --workspaces --pack-destination "${out}"`, { cwd: root, stdio: "inherit" });

console.log("\nTarballs ready in .packs/:");
for (const file of readdirSync(out)) {
  console.log(`  ${resolve(out, file)}`);
}
