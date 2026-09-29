"use server";

import { clearSheetCache } from "@/lib/sheets";

export async function refreshData() {
  clearSheetCache();
}
