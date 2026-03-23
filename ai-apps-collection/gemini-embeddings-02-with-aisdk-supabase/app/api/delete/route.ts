import { NextResponse } from "next/server";
import {
  deleteStoredItem,
  getStoredItemById,
  removeStoredFile,
  type StoredItem,
} from "@/lib/content-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { id } = (await req.json()) as { id?: string };
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  const item = await getStoredItemById(id);
  if (!item) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  await deleteStoredItem(id);

  if (item.kind === "file" && item.storagePath) {
    try {
      await removeStoredFile(item.storagePath);
    } catch {
      // Ignore storage cleanup errors for demo cleanup parity with the previous implementation.
    }
  }

  return NextResponse.json({
    deleted: { id: item.id, kind: item.kind } satisfies Partial<StoredItem>,
  });
}
