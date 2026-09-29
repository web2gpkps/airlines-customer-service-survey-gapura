import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["google-auth-library", "exceljs", "jspdf", "jspdf-autotable"],
};

export default nextConfig;
