import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

function handle(request: Request) {
  return auth.handler(request).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "تعذر تنفيذ الدخول";
    return Response.json({ message }, { status: 500 });
  });
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
