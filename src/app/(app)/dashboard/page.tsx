import { getDashboardStats } from "@/lib/actions";
import { StatCard } from "@/components/dashboard/stat-card";
import { PoundSterling, Hash, Landmark, CreditCard, HandCoins } from "lucide-react";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="flex flex-col gap-6">
      <CardHeader className="p-0">
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>An overview of your sales activity.</CardDescription>
      </CardHeader>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard title="Daily Sales" value={stats.dailySales} icon={PoundSterling} description="Total sales for today" />
        <StatCard title="Total Inputs" value={stats.totalInputs} icon={Hash} description="Total records entered" />
        <StatCard title="Bank Transfers" value={stats.bankAmount} icon={Landmark} description="Total amount via bank" />
        <StatCard title="Card Payments" value={stats.cardAmount} icon={CreditCard} description="Total amount via card" />
        <StatCard title="Cash Payments" value={stats.cashAmount} icon={HandCoins} description="Total amount in cash" />
      </div>
       <div className="text-center text-muted-foreground mt-8">
        <p>Welcome to the Print Today EPOS system.</p>
        <p>Use the navigation on the left to manage your sales data.</p>
      </div>
    </div>
  );
}
