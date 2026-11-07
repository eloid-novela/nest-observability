// Rebuilds every package on change (tsup --watch), all in parallel.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const workspaces = ["@nestjs-observability/core", "@nestjs-observability/nestjs"];

const children = workspaces.map((workspace) =>
  spawn("npm", ["run", "dev", "-w", workspace], { cwd: root, stdio: "inherit", shell: true }),
);

const stop = () => children.forEach((child) => child.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
