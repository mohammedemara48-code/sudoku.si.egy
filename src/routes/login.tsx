import { createFileRoute } from "@tanstack/react-router";
import { LoginPanel } from "@/components/login-panel";

export const Route = createFileRoute("/login")({ component: LoginPanel });
