import type { ReactNode } from "react";
import "./admin.css";

export const metadata = {
  title: "مدیریت فروشگاه",
  description: "پنل مدیریت هایپرمارکت",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="admin-root">{children}</div>;
}
