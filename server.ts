import "dotenv/config";
import express from "express";
import { PrismaClient } from "@prisma/client";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Server starting in", process.env.NODE_ENV, "mode");
if (process.env.VERCEL) {
  console.log("Running on Vercel environment");
}

if (!process.env.DATABASE_URL) {
  console.warn("WARNING: DATABASE_URL is not set. Database features will fail.");
} else {
  console.log("DATABASE_URL is set (length:", process.env.DATABASE_URL.length, ")");
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

async function startServer() {
  console.log("Initializing Express server...");
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // --- API Routes ---

  app.get("/api/ping", (req, res) => {
    res.json({ status: "ok", message: "pong", env: process.env.NODE_ENV });
  });

  // Health check / DB check
  app.get("/api/health", async (req, res) => {
    try {
      await seedIfEmpty();
      // Try to reconnect if the connection was closed
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch (connErr) {
        console.warn("Initial DB check failed, attempting to reconnect...", connErr);
        await prisma.$disconnect();
        await prisma.$connect();
        await prisma.$queryRaw`SELECT 1`;
      }
      res.json({ status: "ok", database: "connected", seeded });
    } catch (e) {
      console.error("Database health check failed:", e);
      res.status(500).json({ status: "error", message: "Database connection failed", details: e instanceof Error ? e.message : String(e) });
    }
  });

  // Members
  app.get("/api/members", async (req, res) => {
    try {
      await seedIfEmpty();
      const members = await prisma.member.findMany({
        orderBy: { name: 'asc' }
      });
      res.json(members);
    } catch (e) {
      console.error("Failed to fetch members:", e);
      res.status(500).json({ error: "Database error. Make sure DATABASE_URL is set and migrations are run." });
    }
  });

  app.post("/api/members", async (req, res) => {
    const { name } = req.body;
    try {
      const member = await prisma.member.create({ data: { name } });
      res.json(member);
    } catch (e) {
      res.status(400).json({ error: "Member already exists or invalid data" });
    }
  });

  app.delete("/api/members/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // Check if member has pending balances (simplified check: has expenses or splits)
      const hasShared = await prisma.sharedExpense.findFirst({ where: { paidById: id } });
      const hasSplits = await prisma.expenseSplit.findFirst({ where: { memberId: id } });
      const hasPersonal = await prisma.personalExpense.findFirst({ where: { memberId: id } });
      
      if (hasShared || hasSplits || hasPersonal) {
        return res.status(400).json({ error: "Cannot delete member with existing records" });
      }
      await prisma.member.delete({ where: { id } });
      res.json({ success: true });
    } catch (e) {
      console.error("Failed to delete member:", e);
      res.status(500).json({ error: "Failed to delete member" });
    }
  });

  // Shared Expenses
  app.get("/api/shared-expenses", async (req, res) => {
    try {
      const expenses = await prisma.sharedExpense.findMany({
        include: { paidBy: true, splits: { include: { member: true } } },
        orderBy: { date: 'desc' }
      });
      res.json(expenses);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  app.post("/api/shared-expenses", async (req, res) => {
    try {
      const { title, amount, paidById, splitType, date, notes, splits } = req.body;
      
      if (!title || !amount || !paidById || !splits || splits.length === 0) {
        return res.status(400).json({ error: "Missing required fields or no participants selected" });
      }

      // splits: Array<{ memberId: number, amountOwed: number }>
      const expense = await prisma.sharedExpense.create({
        data: {
          title,
          amount: parseFloat(amount),
          paidById: parseInt(paidById),
          splitType,
          date: new Date(date),
          notes,
          splits: {
            create: splits.map((s: any) => ({
              memberId: parseInt(s.memberId),
              amountOwed: parseFloat(s.amountOwed)
            }))
          }
        },
        include: { splits: true }
      });
      res.json(expense);
    } catch (e) {
      console.error("Failed to create shared expense:", e);
      res.status(500).json({ error: "Failed to create expense", details: e instanceof Error ? e.message : String(e) });
    }
  });

  app.delete("/api/shared-expenses/:id", async (req, res) => {
    try {
      await prisma.sharedExpense.delete({ where: { id: parseInt(req.params.id) } });
      res.json({ success: true });
    } catch (e) {
      console.error("Failed to delete shared expense:", e);
      res.status(500).json({ error: "Failed to delete shared expense" });
    }
  });

  // Settlements
  app.get("/api/settlements", async (req, res) => {
    try {
      const settlements = await prisma.settlement.findMany({
        include: { fromMember: true, toMember: true },
        orderBy: { date: 'desc' }
      });
      res.json(settlements);
    } catch (e) {
      console.error("Failed to fetch settlements:", e);
      res.status(500).json({ error: "Failed to fetch settlements" });
    }
  });

  app.post("/api/settlements", async (req, res) => {
    try {
      const { fromMemberId, toMemberId, amount, date } = req.body;
      if (!fromMemberId || !toMemberId || !amount) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const settlement = await prisma.settlement.create({
        data: {
          fromMemberId: parseInt(fromMemberId),
          toMemberId: parseInt(toMemberId),
          amount: parseFloat(amount),
          date: new Date(date)
        }
      });
      res.json(settlement);
    } catch (e) {
      console.error("Failed to create settlement:", e);
      res.status(500).json({ error: "Failed to create settlement" });
    }
  });

  // Personal Expenses
  app.get("/api/personal-expenses/:memberId", async (req, res) => {
    try {
      const expenses = await prisma.personalExpense.findMany({
        where: { memberId: parseInt(req.params.memberId) },
        orderBy: { date: 'desc' }
      });
      res.json(expenses);
    } catch (e) {
      console.error("Failed to fetch personal expenses:", e);
      res.status(500).json({ error: "Failed to fetch personal expenses" });
    }
  });

  app.post("/api/personal-expenses", async (req, res) => {
    try {
      const { memberId, title, amount, category, date, notes } = req.body;
      if (!memberId || !title || !amount) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const expense = await prisma.personalExpense.create({
        data: {
          memberId: parseInt(memberId),
          title,
          amount: parseFloat(amount),
          category,
          date: new Date(date),
          notes
        }
      });
      res.json(expense);
    } catch (e) {
      console.error("Failed to create personal expense:", e);
      res.status(500).json({ error: "Failed to create personal expense" });
    }
  });

  // Balances & Debt Simplification
  app.get("/api/balances", async (req, res) => {
    try {
      const members = await prisma.member.findMany();
      const sharedExpenses = await prisma.sharedExpense.findMany({ include: { splits: true } });
      const settlements = await prisma.settlement.findMany();

      const netBalances: Record<number, number> = {};
      members.forEach(m => netBalances[m.id] = 0);

      // Add what they paid
      sharedExpenses.forEach(exp => {
        netBalances[exp.paidById] += exp.amount;
        // Subtract what they owe
        exp.splits.forEach(split => {
          netBalances[split.memberId] -= split.amountOwed;
        });
      });

      // Adjust for settlements
      settlements.forEach(set => {
        netBalances[set.fromMemberId] += set.amount; // Paying off debt increases their net balance (less negative)
        netBalances[set.toMemberId] -= set.amount;   // Receiving payment decreases their credit (less positive)
      });

      // Debt Simplification Algorithm
      const debtors: { id: number, balance: number }[] = [];
      const creditors: { id: number, balance: number }[] = [];

      Object.entries(netBalances).forEach(([idStr, bal]) => {
        const id = parseInt(idStr);
        if (bal < -0.01) debtors.push({ id, balance: -bal });
        else if (bal > 0.01) creditors.push({ id, balance: bal });
      });

      debtors.sort((a, b) => b.balance - a.balance);
      creditors.sort((a, b) => b.balance - a.balance);

      const simplified: { from: number, to: number, amount: number }[] = [];
      let i = 0, j = 0;
      while (i < debtors.length && j < creditors.length) {
        const amount = Math.min(debtors[i].balance, creditors[j].balance);
        simplified.push({ from: debtors[i].id, to: creditors[j].id, amount });
        debtors[i].balance -= amount;
        creditors[j].balance -= amount;
        if (debtors[i].balance < 0.01) i++;
        if (creditors[j].balance < 0.01) j++;
      }

      res.json({
        netBalances,
        simplified
      });
    } catch (e) {
      console.error("Failed to calculate balances:", e);
      res.status(500).json({ error: "Failed to calculate balances" });
    }
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  // Error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Global error handler:", err);
    res.status(500).json({ 
      error: "Internal server error", 
      message: err instanceof Error ? err.message : String(err) 
    });
  });

  return app;
}

export const appPromise = startServer();

// Run seeding check lazily on first health check or member fetch
let seeded = false;
async function seedIfEmpty() {
  if (seeded) return;
  try {
    const count = await prisma.member.count();
    if (count === 0) {
      console.log("Database empty, seeding initial members...");
      const initialMembers = ['Pranish', 'Santosh', 'Prashant', 'Samrat', 'Kshitiz'];
      for (const name of initialMembers) {
        await prisma.member.create({ data: { name } });
      }
      console.log("Seeding complete.");
    }
    seeded = true;
  } catch (e) {
    console.error("Auto-seeding check failed:", e instanceof Error ? e.message : String(e));
  }
}

appPromise.then((app) => {
  const PORT = 3000;
  if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}).catch((err) => {
  console.error("Failed to start server:", err);
});

export default async (req: any, res: any) => {
  const app = await appPromise;
  return app(req, res);
};
