import "server-only";
import type { ResourceType } from "@/generated/prisma/enums";
import type { Actor } from "../actor";
import { type Db, prisma } from "../db";
import { canManageResources } from "../permissions";
import { type ResourceLink, parseHttpUrl, readLinks } from "../services/resources";

export interface ResourceItem {
  id: string;
  title: string;
  url: string;
  host: string;
  description: string;
  type: ResourceType;
  group: string;
  pinned: boolean;
  links: ResourceLink[];
}

export interface ResourceGroup {
  name: string;
  items: ResourceItem[];
}

const OTHER_GROUP = "Other";

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Resources grouped by section. Sections holding pinned items come first, then A→Z, "Other" last;
 * inside a section: pinned first, then by title. Visible to every signed-in (ACTIVE) user.
 */
export async function listResources(actor: Actor, db: Db = prisma): Promise<{ groups: ResourceGroup[]; canManage: boolean; total: number }> {
  const rows = await db.resource.findMany({
    orderBy: [{ pinned: "desc" }, { title: "asc" }],
    take: 500,
    select: { id: true, title: true, url: true, description: true, type: true, group: true, pinned: true, links: true },
  });
  const byGroup = new Map<string, ResourceItem[]>();
  let total = 0;
  for (const r of rows) {
    // Never trust the column blindly (rows can be written outside the app): http(s) only.
    const url = parseHttpUrl(r.url);
    if (!url) continue;
    const name = r.group.trim() || OTHER_GROUP;
    const list = byGroup.get(name) ?? [];
    list.push({ ...r, url, group: name, host: host(url), links: readLinks(r.links) });
    byGroup.set(name, list);
    total++;
  }
  const groups = [...byGroup.entries()]
    .map(([name, items]) => ({ name, items }))
    .sort((a, b) => {
      const pa = a.items.some((i) => i.pinned) ? 0 : 1;
      const pb = b.items.some((i) => i.pinned) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      if (a.name === OTHER_GROUP) return 1;
      if (b.name === OTHER_GROUP) return -1;
      return a.name.localeCompare(b.name);
    });
  return { groups, canManage: canManageResources(actor), total };
}

/** One resource for the edit form (staff only), or null. */
export async function getResourceForEdit(actor: Actor, id: string, db: Db = prisma) {
  if (!canManageResources(actor)) return null;
  const r = await db.resource.findUnique({
    where: { id },
    select: { id: true, title: true, url: true, description: true, type: true, group: true, pinned: true, links: true },
  });
  if (!r) return null;
  return { ...r, linksText: readLinks(r.links).map((l) => `${l.label} | ${l.url}`).join("\n") };
}

/** Existing section names, for the form's suggestions. */
export async function listResourceGroups(db: Db = prisma): Promise<string[]> {
  const rows = await db.resource.findMany({ where: { group: { not: "" } }, distinct: ["group"], select: { group: true }, take: 50 });
  return rows.map((r) => r.group).sort((a, b) => a.localeCompare(b));
}
