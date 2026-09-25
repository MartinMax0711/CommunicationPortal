import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "@/server/actor";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { getResourceForEdit, listResources } from "@/server/queries/resources";
import {
  createResource,
  deleteResource,
  parseHttpUrl,
  parseLinksText,
  readLinks,
  updateResource,
} from "@/server/services/resources";
import { createTestDb, type TestDb } from "./helpers/db";
import { contextFor, makeUser } from "./helpers/factories";

let t: TestDb;
let member: Actor;
let leader: Actor;
let mentor: Actor;
let pendingLeader: Actor;

beforeAll(async () => {
  t = await createTestDb();
  member = await makeUser(t.db, { role: "MEMBER", subteam: "BUILD" });
  leader = await makeUser(t.db, { role: "SOFTWARE_LEADER" });
  mentor = await makeUser(t.db, { role: "MENTOR" });
  pendingLeader = await makeUser(t.db, { role: "BUILD_LEADER", status: "PENDING" });
});
afterAll(async () => {
  await t.drop();
});

const docs = {
  title: "Huskyteers Team Docs",
  url: "https://docs.example.com/team-docs",
  description: "All team materials.",
  type: "DOCUMENT",
  group: "Team Docs",
  pinned: "on",
  links: "Meeting Agenda | https://docs.example.com/team-docs?tab=t.1\nImportant Dates | https://docs.example.com/team-docs?tab=t.2",
};

async function fieldErrors(p: Promise<unknown>) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(ValidationError);
  return (err as ValidationError).fieldErrors;
}

describe("links", () => {
  it("only accepts full http(s) URLs", () => {
    expect(parseHttpUrl("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(parseHttpUrl("  http://example.com ")).toBe("http://example.com/");
    expect(parseHttpUrl("javascript:alert(1)")).toBeNull();
    expect(parseHttpUrl("data:text/html,hi")).toBeNull();
    expect(parseHttpUrl("ftp://example.com")).toBeNull();
    expect(parseHttpUrl("/relative")).toBeNull();
    expect(parseHttpUrl("https://user:pass@example.com")).toBeNull();
    expect(parseHttpUrl("")).toBeNull();
  });

  it("parses quick links, one per line, and names the bad line", () => {
    expect(parseLinksText("A | https://a.example\n\n  https://b.example/x  ")).toEqual([
      { label: "A", url: "https://a.example/" },
      { label: "b.example", url: "https://b.example/x" },
    ]);
    expect(() => parseLinksText("Good | https://a.example\nBad | javascript:alert(1)")).toThrow(ValidationError);
    try {
      parseLinksText("Good | https://a.example\nBad | nope");
    } catch (e) {
      expect((e as ValidationError).fieldErrors.links).toContain("Line 2");
    }
  });

  it("reads stored links defensively", () => {
    expect(readLinks([{ label: "Ok", url: "https://a.example" }, { label: "Evil", url: "javascript:alert(1)" }, "junk", null])).toEqual([
      { label: "Ok", url: "https://a.example/" },
    ]);
    expect(readLinks({ not: "an array" })).toEqual([]);
  });
});

describe("managing resources", () => {
  it("staff can add a pinned resource with quick links", async () => {
    const { id } = await createResource(contextFor(t.db, leader), docs);
    const row = await t.db.resource.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ title: docs.title, url: docs.url, type: "DOCUMENT", group: "Team Docs", pinned: true, createdById: leader.id });
    expect(readLinks(row.links).map((l) => l.label)).toEqual(["Meeting Agenda", "Important Dates"]);
  });

  it("members and not-yet-approved leaders can't change resources", async () => {
    await expect(createResource(contextFor(t.db, member), docs)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createResource(contextFor(t.db, pendingLeader), docs)).rejects.toBeInstanceOf(ForbiddenError);
    const { id } = await createResource(contextFor(t.db, mentor), { ...docs, title: "Guarded" });
    await expect(updateResource(contextFor(t.db, member), { ...docs, resourceId: id, title: "Hacked" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(deleteResource(contextFor(t.db, member), { resourceId: id })).rejects.toBeInstanceOf(ForbiddenError);
    expect((await t.db.resource.findUniqueOrThrow({ where: { id } })).title).toBe("Guarded");
  });

  it("validates the form", async () => {
    const ctx = contextFor(t.db, leader);
    expect(await fieldErrors(createResource(ctx, { ...docs, title: "", url: "javascript:alert(1)" }))).toMatchObject({
      title: "Title is required.",
      url: "Enter a full link starting with https://",
    });
    expect(await fieldErrors(createResource(ctx, { ...docs, type: "EXE" }))).toHaveProperty("type");
    expect(await fieldErrors(createResource(ctx, { ...docs, links: "Bad | nope" }))).toHaveProperty("links");
  });

  it("any staff member can edit or remove a resource; missing ones are NotFound", async () => {
    const { id } = await createResource(contextFor(t.db, leader), { ...docs, title: "Inventory tracker", pinned: "", links: "", group: "Project assets", type: "WEBSITE" });
    await updateResource(contextFor(t.db, mentor), { ...docs, resourceId: id, title: "Inventory tracker v2", pinned: "", links: "", group: "Project assets", type: "WEBSITE" });
    expect((await t.db.resource.findUniqueOrThrow({ where: { id } })).title).toBe("Inventory tracker v2");
    await deleteResource(contextFor(t.db, mentor), { resourceId: id });
    await expect(deleteResource(contextFor(t.db, mentor), { resourceId: id })).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateResource(contextFor(t.db, leader), { ...docs, resourceId: id })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("listing", () => {
  it("everyone sees resources grouped: pinned sections first, 'Other' last; only staff can manage", async () => {
    await t.db.resource.deleteMany();
    const ctx = contextFor(t.db, leader);
    await createResource(ctx, { ...docs, pinned: "on" });
    await createResource(ctx, { title: "Game manual", url: "https://ftc.example/manual.pdf", type: "DOCUMENT", group: "", pinned: "" });
    await createResource(ctx, { title: "Inventory tracker", url: "https://inventory.example.com/", type: "WEBSITE", group: "Project assets", pinned: "" });
    await t.db.resource.create({ data: { title: "Broken links", url: "https://x.example", links: [{ label: "x", url: "javascript:1" }] } });

    const asMember = await listResources(member, t.db);
    expect(asMember.canManage).toBe(false);
    expect(asMember.groups.map((g) => g.name)).toEqual(["Team Docs", "Project assets", "Other"]);
    const tracker = asMember.groups[1].items[0];
    expect(tracker).toMatchObject({ title: "Inventory tracker", host: "inventory.example.com", type: "WEBSITE" });
    expect(asMember.groups[0].items[0].links).toHaveLength(2);
    expect(asMember.groups[2].items.find((i) => i.title === "Broken links")?.links).toEqual([]);

    expect((await listResources(leader, t.db)).canManage).toBe(true);
    const any = asMember.groups[0].items[0];
    expect(await getResourceForEdit(member, any.id, t.db)).toBeNull();
    expect((await getResourceForEdit(leader, any.id, t.db))?.linksText).toContain("Meeting Agenda | https://");
  });
});

describe("edge cases from review", () => {
  it("quick-link URLs and labels may contain '|'", () => {
    expect(parseLinksText("A | B | https://a.example/a|b")).toEqual([{ label: "A | B", url: "https://a.example/a|b" }]);
  });

  it("rejects URLs that would be too long once normalised", () => {
    const long = `https://a.example/${"é".repeat(400)}`; // 418 chars typed, ~2400 once percent-encoded
    expect(long.length).toBeLessThan(2000);
    expect(parseHttpUrl(long)).toBeNull();
  });

  it("hides rows whose main link isn't http(s), even if written straight to the database", async () => {
    await t.db.resource.deleteMany();
    await t.db.resource.create({ data: { title: "Sneaky", url: "data:text/html,<script>alert(1)</script>" } });
    await t.db.resource.create({ data: { title: "Fine", url: "https://ok.example/" } });
    const { groups, total } = await listResources(member, t.db);
    expect(total).toBe(1);
    expect(groups.flatMap((g) => g.items.map((i) => i.title))).toEqual(["Fine"]);
  });
});
