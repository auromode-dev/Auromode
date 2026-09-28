import { AdminDashboard } from "@/components/admin-dashboard";
export const metadata = {
  title: "Reception Dashboard",
  robots: { index: false, follow: false },
};
export default function Admin() {
  return <AdminDashboard />;
}
