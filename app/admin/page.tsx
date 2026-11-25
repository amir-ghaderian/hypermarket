import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import Dashboard from "@/components/dashboard";
import { storeSetupComplete } from "@/lib/store";
import { userCount } from "@/lib/auth";


export default async function Home() {
  const user = await currentUser();
  if (!user) redirect(!storeSetupComplete() && (await userCount()) === 0 ? "/admin/setup" : "/admin/login");
  return <Dashboard user={user} />;
}
