import { Dashboard } from "@/components/Dashboard";
import { LoadError } from "@/components/LoadError";
import { getDashboardData, toClientData } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export default async function Page() {
  try {
    const data = await getDashboardData();
    return <Dashboard data={toClientData(data)} />;
  } catch (err) {
    console.error("Gagal memuat data survei:", err);
    return <LoadError message={err instanceof Error ? err.message : String(err)} />;
  }
}
