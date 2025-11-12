import { getTransactions } from "@/lib/actions";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { TransactionsTable } from "@/components/transactions/transactions-table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const dynamic = 'force-dynamic';

export default async function NonInvoicingPage() {
  const transactions = await getTransactions('non-invoicing');

  return (
    <div className="flex flex-col gap-6">
      <TransactionForm type="non-invoicing" />
      <Card>
        <CardHeader>
          <CardTitle>Recent Non-Invoice Sales</CardTitle>
          <CardDescription>A list of the most recent non-invoicing transactions.</CardDescription>
        </CardHeader>
        <CardContent>
          <TransactionsTable transactions={transactions} />
        </CardContent>
      </Card>
    </div>
  );
}
