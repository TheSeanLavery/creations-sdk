import { serve } from "bun";
import { join } from "path";
import { stat } from "fs/promises";

const PORT = parseInt(process.env.PORT || "3056", 10);
const ROOT = join(process.cwd(), "plugin-demo");
const MOUNTS: Array<{ prefix: string; dir: string }> = [
  { prefix: "/qr-final/", dir: join(process.cwd(), "qr/final") },
  { prefix: "/qr/", dir: join(process.cwd(), "qr") },
  { prefix: "/", dir: ROOT },
];

async function fileExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isFile();
  } catch {
    return false;
  }
}

function resolveMount(pathname: string): { mountDir: string; relativePath: string } {
  const cleanPath = pathname.split("?")[0].split("#")[0];
  // Find the longest matching prefix
  const mount = MOUNTS.find(m => cleanPath.startsWith(m.prefix)) || MOUNTS[MOUNTS.length - 1];
  const relative = cleanPath.slice(mount.prefix.length).replace(/^\//, "");
  return { mountDir: mount.dir, relativePath: relative };
}

serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // Default to index.html for root or non-file routes
    let pathname = url.pathname;
    const { mountDir, relativePath } = resolveMount(pathname);
    const requested = relativePath === "" ? "index.html" : relativePath;
    let fsPath = join(mountDir, requested);

    // Fallback to index.html for SPA routes
    if (!(await fileExists(fsPath))) {
      fsPath = join(mountDir, "index.html");
    }

    const file = Bun.file(fsPath);
    if (!(await file.exists())) {
      return new Response("Not Found", { status: 404 });
    }

    return new Response(file);
  },
});

console.log(`Server running on http://localhost:${PORT}`);


