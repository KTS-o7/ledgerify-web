import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/shared/Sidebar";
import { BottomNav } from "@/components/shared/BottomNav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/auth/login");

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <Sidebar className="hidden md:flex md:flex-col" />

      {/* Main content — add bottom padding on mobile for bottom nav */}
      <main className="min-w-0 flex-1 overflow-y-auto pb-24 md:pb-0">
        <div className="min-h-screen bg-background/70">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <BottomNav className="md:hidden" />
    </div>
  );
}
