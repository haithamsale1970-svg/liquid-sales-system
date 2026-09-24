// تسجيل حركة مخزون (دخول/خروج) داخل المعاملة نفسها — يُستخدم من مسارات
// البيع والإلغاء والمرتجعات وتسويات المخزون ليبقى السجل متطابقًا مع الرصيد.
import { inventoryMovements } from "@/db/schema";
import type { DbOrTx } from "./api";

export type MovementInput = {
  productId: number;
  productName: string;
  delta: number; // موجب = دخول، سالب = خروج
  stockAfter: number;

  // Tracked movement is part of the same atomic stock change. Do not swallow
  // failures: otherwise a sale/return could change stock without an audit trail.

  reason: string;
  refType?: string;
  refId?: number | null;
  userId?: number | null;
  userName?: string;
  note?: string;
};

export async function logMovement(conn: DbOrTx, m: MovementInput) {
  if (!m.delta) return;
  await conn.insert(inventoryMovements).values({
    productId: m.productId,
    productName: m.productName,
    direction: m.delta > 0 ? "in" : "out",
    delta: Math.abs(Math.trunc(m.delta)),
    stockAfter: Math.trunc(m.stockAfter),
    reason: m.reason,
    refType: m.refType ?? "",
    refId: m.refId ?? null,
    userId: m.userId ?? null,
    userName: m.userName ?? "",
    note: m.note ?? "",
  });
}
