import { createFileRoute } from "@tanstack/react-router";

async function handle(request: Request) {
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
