import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { useDemoAuth } from "@/lib/demo-auth";
import { GuardShell, GuardSignInRequired } from "@/components/pg/guard-layout";

export const Route = createFileRoute("/guard")({
  component: GuardLayout,
});

// Auth pages are public; every other /guard route requires a (demo) session.
const AUTH_PAGES = [
  "/guard/login",
  "/guard/register",
  "/guard/forgot-password",
  "/guard/reset-password",
  "/guard/verify-email",
  "/guard/invite",
];

function GuardLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { session, ready } = useDemoAuth();

  if (AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return <Outlet />;
  }
  if (!ready) return null;
  if (!session || session.role !== "guard") {
    return <GuardSignInRequired />;
  }
  return (
    <GuardShell>
      <Outlet />
    </GuardShell>
  );
}
