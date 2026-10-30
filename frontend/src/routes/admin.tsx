import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { useDemoAuth } from "@/lib/demo-auth";
import { AdminShell, AdminSignInRequired } from "@/components/pg/admin-layout";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { session, ready } = useDemoAuth();

  if (pathname === "/admin/login" || pathname === "/admin/forgot-password") {
    return <Outlet />;
  }
  if (!ready) return null;
  if (!session || session.role !== "admin") {
    return <AdminSignInRequired />;
  }
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
