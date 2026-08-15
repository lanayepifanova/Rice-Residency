import { randomUUID } from "crypto";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Helpers shared by the integration tests.
 *
 * Every row created by a test carries the same run-scoped email suffix, so
 * teardown can remove exactly what the run made and nothing that was already
 * there. Deleting users cascades to their series, occurrences, and RSVPs.
 */
export const TEST_EMAIL_DOMAIN = "matane-integration.test";

export function testEmail(label: string): string {
  return `${label}-${randomUUID().slice(0, 8)}@${TEST_EMAIL_DOMAIN}`;
}

export async function createTestUser(label: string): Promise<User> {
  return prisma.user.create({
    data: { id: randomUUID(), email: testEmail(label), name: label },
  });
}

export async function cleanupTestData(): Promise<void> {
  await prisma.user.deleteMany({
    where: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}` } },
  });
}

/** A local wall-clock time a given number of days from now, "YYYY-MM-DDTHH:MM". */
export function localDaysFromNow(days: number, time = "18:30"): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.toISOString().slice(0, 10)}T${time}`;
}
