import { serve } from "bun";
import { join, sep } from "path";
import { stat, readdir } from "fs/promises";

const PORT = parseInt(process.env.PORT || "3056", 10);

const ROOT_PUBLIC = join(process.cwd(), "public");
const ROOT_CREATIONS = join(process.cwd(), "creations");
const BALL_DIST = join(process.cwd(), "creations/bouncing_ball_game/apps/app/dist");

type Mount = { prefix: string; dir: string };
const MOUNTS: Mount[] = [
  { prefix: "/ball/", dir: BALL_DIST },
  { prefix: "/creations/", dir: ROOT_CREATIONS },
  { prefix: "/", dir: ROOT_PUBLIC },
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
  // Longest prefix match
  const mount = MOUNTS.sort((a, b) => b.prefix.length - a.prefix.length).find(m => cleanPath.startsWith(m.prefix)) || MOUNTS[MOUNTS.length - 1];
  const relative = cleanPath.slice(mount.prefix.length).replace(/^\//, "");
  return { mountDir: mount.dir, relativePath: relative };
}

async function listCreations(): Promise<Array<{ label: string; url: string }>> {
  const results: Array<{ label: string; url: string }> = [];

  async function walk(dir: string, rel: string) {
    let entries: string[] = [];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const abs = join(dir, name);
      let s;
      try { s = await stat(abs); } catch { continue; }
      if (s.isDirectory()) {
        await walk(abs, rel ? rel + "/" + name : name);
      } else if (name.toLowerCase() === "index.html") {
        const url = "/creations/" + (rel ? rel + "/" : "") + "index.html";
        const label = (rel || "").split(/[\\/]/).filter(Boolean).join(" / ") || "(root)";
        results.push({ label, url });
      }
    }
  }

  await walk(ROOT_CREATIONS, "");
  // Sort by label for stability
  results.sort((a, b) => a.label.localeCompare(b.label));
  return results;
}

serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    if (pathname === "/api/creations") {
      const list = await listCreations();
      return new Response(JSON.stringify({ items: list }), { headers: { "content-type": "application/json" } });
    }

    // Optional: simple network info used by QR pages
    if (pathname === "/api/network-info") {
      const proto = url.protocol.replace(":", "");
      const origin = `${proto}://${url.host}`;
      return new Response(JSON.stringify({ byHeader: { ballUrl: origin + "/ball/" }, urlsByAddress: [] }), { headers: { "content-type": "application/json" } });
    }

    const { mountDir, relativePath } = resolveMount(pathname);
    const requested = relativePath === "" ? "index.html" : relativePath;
    let fsPath = join(mountDir, requested);

    const file = Bun.file(fsPath);
    if (await file.exists()) {
      return new Response(file);
    }

    // Fallback to index.html within the same mount
    const fallback = Bun.file(join(mountDir, "index.html"));
    if (await fallback.exists()) {
      return new Response(fallback);
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Server running on http://localhost:${PORT}`);


