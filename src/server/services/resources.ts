// Resources page: shared links (team docs, CAD, tools…). Everyone ACTIVE can view;
// staff (leaders, captain, mentors, teachers, admins) can add, edit, and remove.
import { z } from "zod";
import { LIMITS, RESOURCE_TYPES } from "@/lib/constants";
import { checkbox, idSchema, optionalText, text } from "@/lib/validation";
import { parseInput } from "../action";
import type { ServiceContext } from "../context";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { canManageResources } from "../permissions";
import { enforceRateLimit } from "../rate-limit";

export const RESOURCE_NOT_FOUND = "That resource no longer exists.";

/** An absolute http(s) URL, normalised. Anything else (javascript:, data:, relative…) is rejected. */
export function parseHttpUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw || raw.length > LIMITS.resourceUrlMax) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    // Percent-encoding can lengthen it; the stored value must still fit so it can be saved again.
    return url.href.length <= LIMITS.resourceUrlMax ? url.href : null;
  } catch {
    return null;
  }
}

const urlField = z
  .string({ error: "Link is required." })
  .trim()
  .min(1, "Link is required.")
  .transform((v, ctx) => {
    const url = parseHttpUrl(v);
    if (!url) {
      ctx.addIssue({ code: "custom", message: "Enter a full link starting with https://" });
      return z.NEVER;
    }
    return url;
  });

export interface ResourceLink {
  label: string;
  url: string;
}

/** Stored JSON → links, dropping anything malformed (never trusts the column blindly). */
export function readLinks(value: unknown): ResourceLink[] {
  if (!Array.isArray(value)) return [];
  const out: ResourceLink[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const { label, url } = item as Record<string, unknown>;
    const safeUrl = typeof url === "string" ? parseHttpUrl(url) : null;
    if (typeof label !== "string" || !label.trim() || !safeUrl) continue;
    out.push({ label: label.trim().slice(0, LIMITS.resourceLinkLabelMax), url: safeUrl });
  }
  return out.slice(0, LIMITS.resourceLinksMax);
}

/**
 * "Quick links" textarea → links. One per line: `Label | https://…` (or just a URL, labelled by its host).
 * Throws ValidationError on the `links` field naming the bad line.
 */
export function parseLinksText(value: string): ResourceLink[] {
  const lines = value
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length > LIMITS.resourceLinksMax) {
    throw new ValidationError("Too many quick links.", { links: `Add at most ${LIMITS.resourceLinksMax} quick links.` });
  }
  return lines.map((line, i) => {
    // "Label | https://…": split at the "|" that starts the URL, so labels and URLs may contain "|" too.
    const m = line.match(/^(.*?)\s*\|\s*(\S+:\/\/.*)$/);
    const labelPart = m ? m[1].trim() : "";
    const urlPart = m ? m[2].trim() : line;
    const url = parseHttpUrl(urlPart);
    if (!url) {
      throw new ValidationError("Please fix the quick links.", {
        links: `Line ${i + 1}: use “Label | https://…” with a full link.`,
      });
    }
    const label = (labelPart || new URL(url).hostname).slice(0, LIMITS.resourceLinkLabelMax);
    return { label, url };
  });
}

const resourceInput = z.object({
  title: text("Title", LIMITS.resourceTitleMax),
  url: urlField,
  description: optionalText("Description", LIMITS.resourceDescriptionMax),
  type: z.enum(RESOURCE_TYPES as [string, ...string[]], { error: "Pick a type." }),
  group: optionalText("Section", LIMITS.resourceGroupMax),
  pinned: checkbox,
  links: z.string().max(10_000, "Too many quick links.").optional().default(""),
});

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function assertCanManage(ctx: ServiceContext) {
  if (ctx.actor.status !== "ACTIVE" || !canManageResources(ctx.actor)) {
    throw new ForbiddenError("Only leaders, mentors, teachers, and admins can change resources.");
  }
}

function toData(data: z.infer<typeof resourceInput>) {
  return {
    title: data.title,
    url: data.url,
    description: data.description ?? "",
    type: data.type as (typeof RESOURCE_TYPES)[number],
    group: data.group ?? "",
    pinned: data.pinned,
    links: parseLinksText(data.links) as unknown as object,
  };
}

export async function createResource(ctx: ServiceContext, raw: unknown): Promise<{ id: string }> {
  assertCanManage(ctx);
  const data = parseInput(resourceInput, asRecord(raw));
  await enforceRateLimit(ctx.db, `resource:${ctx.actor.id}`, 60, 60 * 60 * 1000, ctx.now);
  const created = await ctx.db.resource.create({ data: { ...toData(data), createdById: ctx.actor.id }, select: { id: true } });
  return created;
}

const updateInput = resourceInput.extend({ resourceId: idSchema });

export async function updateResource(ctx: ServiceContext, raw: unknown): Promise<{ id: string }> {
  assertCanManage(ctx);
  const data = parseInput(updateInput, asRecord(raw));
  const { count } = await ctx.db.resource.updateMany({ where: { id: data.resourceId }, data: toData(data) });
  if (count === 0) throw new NotFoundError(RESOURCE_NOT_FOUND);
  return { id: data.resourceId };
}

export async function deleteResource(ctx: ServiceContext, raw: unknown): Promise<void> {
  assertCanManage(ctx);
  const { resourceId } = parseInput(z.object({ resourceId: idSchema }), asRecord(raw));
  const { count } = await ctx.db.resource.deleteMany({ where: { id: resourceId } });
  if (count === 0) throw new NotFoundError(RESOURCE_NOT_FOUND);
}
