import { createFileRoute } from "@tanstack/react-router";

async function handle(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("ping") === "1") {
    return Response.json({ ping: true });
  }
  if (url.searchParams.get("diag") === "1") {
    try {
      const { PGlite } = await import("@electric-sql/pglite");
      const pg = new PGlite();
      const result = await pg.query<{ ok: number }>("select 1 as ok");
      return Response.json({ pglite: true, rows: result.rows });
    } catch (error: unknown) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      return Response.json({ pglite: false, message }, { status: 500 });
    }
  }
  try {
    const { auth } = await import("@/lib/auth/server");
    return await auth.handler(request);
  } catch (error: unknown) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : "تعذر تنفيذ الدخول";
    return Response.json({ message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
