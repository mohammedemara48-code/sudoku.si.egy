import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export type WeeklyRow = {
  displayName: string;
  seconds: number;
  mine: boolean;
};

function currentWeekKey(date = new Date()): number {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return utc.getUTCFullYear() * 100 + week;
}

async function displayName(userId: string): Promise<string> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ name: string }>`select name from "user" where id = ${userId} limit 1`;
  const name = rows[0]?.name?.trim();
  return name || "لاعب";
}

export const listWeekly = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<WeeklyRow[]> => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const week = currentWeekKey();
    const rows = await sql<{ display_name: string; seconds: number; user_id: string }>`
      select display_name, seconds, user_id
      from weekly_results
      where week_key = ${week}
      order by seconds asc
      limit 12
    `;
    return rows.map((row) => ({
      displayName: row.display_name,
      seconds: row.seconds,
      mine: row.user_id === context.userId,
    }));
  });

export const submitWeekly = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { seconds: number }) => {
    const seconds = Math.floor(Number(input?.seconds));
    if (!Number.isFinite(seconds) || seconds < 1 || seconds > 24 * 60 * 60) {
      throw new Error("وقت غير صالح");
    }
    return { seconds };
  })
  .handler(async ({ context, data }): Promise<WeeklyRow[]> => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const week = currentWeekKey();
    const name = await displayName(context.userId);
    await sql`
      insert into weekly_results (week_key, user_id, display_name, seconds)
      values (${week}, ${context.userId}, ${name}, ${data.seconds})
      on conflict (week_key, user_id) do update
      set seconds = excluded.seconds,
          display_name = excluded.display_name,
          finished_at = now()
      where weekly_results.seconds > excluded.seconds
    `;
    const rows = await sql<{ display_name: string; seconds: number; user_id: string }>`
      select display_name, seconds, user_id
      from weekly_results
      where week_key = ${week}
      order by seconds asc
      limit 12
    `;
    return rows.map((row) => ({
      displayName: row.display_name,
      seconds: row.seconds,
      mine: row.user_id === context.userId,
    }));
  });
