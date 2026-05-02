"use server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { transactions, transactionTags, users, categories, accounts } from "@/lib/db/schema";
import { transactionSchema } from "@/lib/validations/transaction";
import { getRate } from "@/lib/utils/currency";
import { eq, and, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

function normalizeOptionalTransactionFields(
  raw: Record<string, FormDataEntryValue>,
) {
  const normalized = { ...raw };

  for (const key of [
    "categoryId",
    "transferToId",
    "recurrenceRule",
    "tagIds",
    "note",
  ] as const) {
    if (normalized[key] === "") {
      delete normalized[key];
    }
  }

  return normalized;
}

export async function createTransaction(_: unknown, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const raw = normalizeOptionalTransactionFields(Object.fromEntries(formData));
  const parsed = transactionSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { tagIds, ...data } = parsed.data;

  // Verify accountId belongs to the current user
  if (data.accountId) {
    const accountCheck = await db.query.accounts.findFirst({
      where: and(eq(accounts.id, data.accountId), eq(accounts.userId, session.user.id), isNull(accounts.deletedAt)),
    });
    if (!accountCheck) return { error: "Account not found or not yours" };
  }

  // Verify categoryId is current-user-owned or system
  if (data.categoryId) {
    const catCheck = await db.query.categories.findFirst({
      where: and(
        eq(categories.id, data.categoryId),
        isNull(categories.deletedAt),
        or(eq(categories.userId, session.user.id), isNull(categories.userId)),
      ),
    });
    if (!catCheck) return { error: "Category not found or not yours" };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });
  const baseCurrency = user?.defaultCurrency ?? "INR";
  const rate = await getRate(data.currency, baseCurrency);

  const [tx] = await db
    .insert(transactions)
    .values({
      ...data,
      userId: session.user.id,
      amount: String(data.amount),
      convertedAmount: String(data.amount * rate),
      baseCurrency,
      isRecurring: data.isRecurring ?? false,
    })
    .returning();

  if (tagIds) {
    const ids = tagIds.split(",").filter(Boolean);
    if (ids.length > 0) {
      await db
        .insert(transactionTags)
        .values(ids.map((tagId) => ({ transactionId: tx.id, tagId })));
    }
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: true, id: tx.id };
}

export async function updateTransaction(_: unknown, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const id = formData.get("id") as string;
  if (!id) return { error: "Missing id" };

  const raw = normalizeOptionalTransactionFields(Object.fromEntries(formData));
  const parsed = transactionSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { tagIds: _tagIds, ...data } = parsed.data;

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });
  const baseCurrency = user?.defaultCurrency ?? "INR";
  const rate = await getRate(data.currency, baseCurrency);

  await db
    .update(transactions)
    .set({
      ...data,
      amount: String(data.amount),
      convertedAmount: String(data.amount * rate),
      baseCurrency,
      updatedAt: new Date(),
    })
    .where(
      and(eq(transactions.id, id), eq(transactions.userId, session.user.id)),
    );

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteTransaction(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  await db
    .update(transactions)
    .set({ deletedAt: new Date() })
    .where(
      and(eq(transactions.id, id), eq(transactions.userId, session.user.id)),
    );

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: true };
}
