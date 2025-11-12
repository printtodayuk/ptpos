import { getPendingTransactions } from '@/lib/actions';
import { AdminClient } from '@/components/admin/admin-client';
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const pendingTransactions = await getPendingTransactions();

  return (
    <div className="flex flex-col gap-6">
        <CardHeader className="p-0">
            <CardTitle>Admin Verification</CardTitle>
            <CardDescription>Review and mark transactions as checked for accounting.</CardDescription>
        </CardHeader>
        <AdminClient pendingTransactions={pendingTransactions} />
    </div>
  );
}
