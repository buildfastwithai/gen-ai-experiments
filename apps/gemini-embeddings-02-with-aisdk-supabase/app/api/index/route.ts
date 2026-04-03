import { NextResponse } from "next/server";
import { listStoredItems, sanitizeStoredItem } from "@/lib/content-store";

export const runtime = "nodejs";

export async function GET() {
  const items = await listStoredItems();
  return NextResponse.json({ items: items.map((item) => sanitizeStoredItem(item)) });
}
