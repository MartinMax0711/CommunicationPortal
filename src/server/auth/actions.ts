"use server";

import { redirect } from "next/navigation";
import { endSession } from "./session";

/** Sign out of this device. */
export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/login");
}
