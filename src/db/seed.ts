import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import {
  activityLogs,
  clients,
  productFields,
  products,
  saleItems,
  sales,
  users,
} from "./schema";

const url =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/app_db";

const db = drizzle(new Pool({ connectionString: url }));

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f2 = (n: number) => n.toFixed(2);

async function main() {
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length) {
    console.log("✓ البيانات موجودة بالفعل — تم تخطي التهيئة");
    process.exit(0);
  }

  const rnd = mulberry32(20260101);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];

  // ---------- users ----------
  const [admin, partner] = await db
    .insert(users)
    .values([
      {
        username: "admin",
        name: "مدير النظام",
        passwordHash: await bcrypt.hash("admin123", 10),
        role: "admin" as const,
      },
      {
        username: "partner",
        name: "كريم الشريك",
        passwordHash: await bcrypt.hash("partner123", 10),
        role: "user" as const,
      },
    ])
    .returning({ id: users.id, name: users.name });
  console.log("✓ users: admin/admin123 — partner/partner123");

  // ---------- products ----------
  const productRows = [
    {
      name: "مانجو آيس 60مل",
      category: "سولت نيكوتين",
      description: "نكهة المانجو الاستوائية مع انتعاش الثلج — الأكثر طلبًا",
      price: "260.00",
      cost: "165.00",
      stock: 22,
      lowStockAt: 6,
      imageUrl: "/images/p-mango.jpg",
      fields: [
        { label: "نسبة النيكوتين", value: "30 مج" },
        { label: "حجم الزجاجة", value: "60 مل" },
        { label: "VG/PG", value: "50/50" },
      ],
    },
    {
      name: "نعناع منثول 60مل",
      category: "سولت نيكوتين",
      description: "برودة النعناع النقي بتركيز عالٍ",
      price: "230.00",
      cost: "140.00",
      stock: 31,
      lowStockAt: 6,
      imageUrl: "/images/p-mint.jpg",
      fields: [
        { label: "نسبة النيكوتين", value: "25 مج" },
        { label: "حجم الزجاجة", value: "60 مل" },
      ],
    },
    {
      name: "تبغ كلاسيك 60مل",
      category: "فري بيز",
      description: "نكهة التبغ الفاخرة للمدخنين التقليديين",
      price: "240.00",
      cost: "150.00",
      stock: 6,
      lowStockAt: 8,
      imageUrl: "/images/p-tobacco.jpg",
      fields: [
        { label: "نسبة النيكوتين", value: "12 مج" },
        { label: "VG/PG", value: "70/30" },
      ],
    },
    {
      name: "توت مشكل فروست 60مل",
      category: "سولت نيكوتين",
      description: "خلطة التوت البري والفراولة مع لمسة فروست",
      price: "270.00",
      cost: "170.00",
      stock: 17,
      lowStockAt: 5,
      imageUrl: "/images/p-berries.jpg",
      fields: [
        { label: "نسبة النيكوتين", value: "30 مج" },
        { label: "حجم الزجاجة", value: "60 مل" },
      ],
    },
    {
      name: "عنب آيس 30مل",
      category: "سولت نيكوتين",
      description: "عنب داكن مثلج بحجم صغير مركّز",
      price: "250.00",
      cost: "160.00",
      stock: 4,
      lowStockAt: 5,
      imageUrl: "/images/p-grape.jpg",
      fields: [
        { label: "نسبة النيكوتين", value: "50 مج" },
        { label: "حجم الزجاجة", value: "30 مل" },
      ],
    },
    {
      name: "تفاح أخضر حامض 60مل",
      category: "فري بيز",
      description: "حموضة التفاح الأخضر المنعشة",
      price: "220.00",
      cost: "135.00",
      stock: 40,
      lowStockAt: 8,
      imageUrl: "",
      fields: [
        { label: "نسبة النيكوتين", value: "6 مج" },
        { label: "VG/PG", value: "70/30" },
      ],
    },
    {
      name: "ليمون بالنعناع 60مل",
      category: "فري بيز",
      description: "ليمون ساحلي بانتعاش النعناع",
      price: "210.00",
      cost: "130.00",
      stock: 0,
      lowStockAt: 5,
      imageUrl: "",
      fields: [{ label: "نسبة النيكوتين", value: "12 مج" }],
    },
    {
      name: "فانيليا كاسترد 60مل",
      category: "فري بيز",
      description: "كاسترد الفانيليا الكريمي الفاخر",
      price: "280.00",
      cost: "180.00",
      stock: 12,
      lowStockAt: 5,
      imageUrl: "",
      fields: [
        { label: "نسبة النيكوتين", value: "6 مج" },
        { label: "VG/PG", value: "80/20" },
      ],
    },
  ];

  const insertedProducts: Array<{
    id: number;
    name: string;
    price: number;
    cost: number;
    imageUrl: string;
  }> = [];
  for (const p of productRows) {
    const { fields, ...row } = p;
    const [ins] = await db.insert(products).values(row).returning({ id: products.id });
    if (fields.length) {
      await db
        .insert(productFields)
        .values(fields.map((f) => ({ productId: ins.id, ...f })));
    }
    insertedProducts.push({
      id: ins.id,
      name: p.name,
      price: parseFloat(p.price),
      cost: parseFloat(p.cost),
      imageUrl: p.imageUrl,
    });
    await db.insert(activityLogs).values({
      userId: admin.id,
      userName: admin.name,
      action: "إضافة منتج",
      entity: "منتج",
      entityId: ins.id,
      details: `إضافة المنتج "${p.name}" — المخزون: ${p.stock}`,
      createdAt: new Date(Date.now() - (46 + rnd() * 5) * 86400000),
    });
  }
  console.log(`✓ products: ${insertedProducts.length}`);

  // ---------- clients ----------
  const clientRows = [
    { name: "محل النخبة للفيب", type: "store" as const, phone: "01001234567", address: "مدينة نصر، القاهرة", notes: "أسعار جملة درجة أولى" },
    { name: "شركة الدلتا للتوزيع", type: "company" as const, phone: "0223456789", address: "سموحة، الإسكندرية", notes: "شحن خارجي ثابت" },
    { name: "أحمد سامي", type: "individual" as const, phone: "01112345678", address: "الدقي، الجيزة", notes: "" },
    { name: "محل السلام", type: "store" as const, phone: "01099887766", address: "شبرا، القاهرة", notes: "دفع كاش عند الاستلام" },
    { name: "شركة النور للتجارة", type: "company" as const, phone: "0401234567", address: "طنطا، الغربية", notes: "" },
  ];
  const insertedClients = await db
    .insert(clients)
    .values(clientRows)
    .returning({ id: clients.id, name: clients.name });
  console.log(`✓ clients: ${insertedClients.length}`);

  // ---------- sales (45 days) ----------
  type Draft = {
    clientId: number;
    clientName: string;
    userId: number;
    userName: string;
    createdAt: Date;
    shippingType: "none" | "internal" | "external";
    shippingCost: number;
    items: Array<{
      productId: number;
      productName: string;
      imageUrl: string;
      price: number;
      cost: number;
      quantity: number;
    }>;
  };
  const drafts: Draft[] = [];
  const sellable = insertedProducts;
  for (let i = 0; i < 52; i++) {
    const daysAgo = Math.floor(Math.pow(rnd(), 1.35) * 45); // أكثر كثافة قريبًا
    const when = new Date(
      Date.now() - daysAgo * 86400000 - Math.floor(rnd() * 10 + 1) * 3600000,
    );
    const client = pick(insertedClients);
    const seller = rnd() < 0.62 ? admin : partner;
    const itemCount = 1 + Math.floor(rnd() * 3);
    const chosen = new Set<number>();
    const items: Draft["items"] = [];
    for (let j = 0; j < itemCount; j++) {
      let p = pick(sellable);
      let guard = 0;
      while (chosen.has(p.id) && guard++ < 10) p = pick(sellable);
      if (chosen.has(p.id)) continue;
      chosen.add(p.id);
      items.push({
        productId: p.id,
        productName: p.name,
        imageUrl: p.imageUrl,
        price: p.price,
        cost: p.cost,
        quantity: 1 + Math.floor(rnd() * 5),
      });
    }
    const shipRoll = rnd();
    const shippingType =
      shipRoll < 0.4 ? "none" : shipRoll < 0.7 ? "internal" : "external";
    const shippingCost =
      shippingType === "none" ? 0 : shippingType === "internal" ? 30 : 60;
    drafts.push({
      clientId: client.id,
      clientName: client.name,
      userId: seller.id,
      userName: seller.name,
      createdAt: when,
      shippingType,
      shippingCost,
      items,
    });
  }
  drafts.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  for (const d of drafts) {
    const subtotal = d.items.reduce((a, it) => a + it.price * it.quantity, 0);
    const profit = d.items.reduce((a, it) => a + (it.price - it.cost) * it.quantity, 0);
    const total = subtotal + d.shippingCost;
    const [sale] = await db
      .insert(sales)
      .values({
        clientId: d.clientId,
        userId: d.userId,
        subtotal: f2(subtotal),
        shippingType: d.shippingType,
        shippingCost: f2(d.shippingCost),
        total: f2(total),
        profit: f2(profit),
        createdAt: d.createdAt,
      })
      .returning({ id: sales.id });
    await db.insert(saleItems).values(
      d.items.map((it) => ({
        saleId: sale.id,
        productId: it.productId,
        productName: it.productName,
        imageUrl: it.imageUrl,
        price: f2(it.price),
        cost: f2(it.cost),
        quantity: it.quantity,
        lineTotal: f2(it.price * it.quantity),
      })),
    );
    await db.insert(activityLogs).values({
      userId: d.userId,
      userName: d.userName,
      action: "إنشاء فاتورة",
      entity: "فاتورة",
      entityId: sale.id,
      details: `فاتورة INV-${String(sale.id).padStart(5, "0")} للعميل "${d.clientName}" بقيمة ${f2(total)}`,
      createdAt: d.createdAt,
    });
  }
  console.log(`✓ sales: ${drafts.length} فاتورة`);

  console.log("\nتهيئة قاعدة البيانات اكتملت بنجاح ✓");
  console.log("ادخل بحساب: admin / admin123 (غيّره فورًا من الإعدادات)");
  process.exit(0);
}

main().catch((e) => {
  console.error("فشلت التهيئة:", e);
  process.exit(1);
});
