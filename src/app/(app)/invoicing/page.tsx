import { getTransactions } from "@/lib/actions";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { TransactionsTable } from "@/components/transactions/transactions-table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const dynamic = 'force-dynamic';

export default async function InvoicingPage() {
  const transactions = await getTransactions('invoicing');

  return (
    <div className="flex flex-col gap-6">
      <TransactionForm type="invoicing" />
      <Card>
        <CardHeader>
          <CardTitle>Recent Invoices</CardTitle>
          <CardDescription>A list of the most recent invoicing transactions.</CardDescription>
        </CardHeader>
        <CardContent>
          <TransactionsTable transactions={transactions} />
        </CardContent>
      </Card>
    </div>
  );
}
