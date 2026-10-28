import { redirect } from "next/navigation";
import { Dashboard } from "@/components/Dashboard";
import { LoadError } from "@/components/LoadError";
import { isAdmin } from "@/lib/admin";
import { publicOrigin } from "@/lib/site-url";
import { getDashboardData, toClientData } from "@/lib/sheets";
import { getTargetData } from "@/lib/target-sampling";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!(await isAdmin())) redirect("/login?next=/akses-cabang");
  try {
    const data = await getDashboardData();
    const targets = await getTargetData(data.segments.airline.responses);
    return <Dashboard data={toClientData(data)} variant="admin-cabang" targets={targets} shareOrigin={publicOrigin()} />;
  } catch (err) {
    console.error("Gagal memuat data survei:", err);
    return <LoadError message={err instanceof Error ? err.message : String(err)} />;
  }
}
