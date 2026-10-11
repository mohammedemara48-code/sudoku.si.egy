import { createFileRoute } from "@tanstack/react-router";
import { SignInGate } from "@/lib/auth/gates";
import { LoginPanel } from "@/components/login-panel";
import { SudokuDesk } from "@/components/sudoku-desk";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <SignInGate fallback={<LoginPanel />}>
      <SudokuDesk />
    </SignInGate>
  );
}
