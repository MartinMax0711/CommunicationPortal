import type { AccountStatus, Role, Subteam } from "@/generated/prisma/enums";

/** The signed-in user as seen by services and permission checks. */
export interface Actor {
  id: string;
  name: string;
  email: string;
  role: Role;
  subteam: Subteam | null;
  status: AccountStatus;
  isAdmin: boolean;
}

/** Prisma `select` that produces an Actor. */
export const actorSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  subteam: true,
  status: true,
  isAdmin: true,
} as const;
