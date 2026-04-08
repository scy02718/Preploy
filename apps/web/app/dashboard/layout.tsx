import { Sidebar } from "@/components/shared/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <aside className="hidden md:block w-64 border-r">
        <Sidebar />
      </aside>
      <div className="flex-1 overflow-auto p-6">{children}</div>
    </div>
  );
}
