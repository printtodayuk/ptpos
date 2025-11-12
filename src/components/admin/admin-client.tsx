'use client';

import { useTransition } from 'react';
import { format } from 'date-fns';
import { CheckCircle, Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { markTransactionAsChecked } from '@/lib/server-actions';
import type { Transaction } from '@/lib/types';
import { Card } from '../ui/card';

type AdminClientProps = {
  pendingTransactions: Transaction[];
  onTransactionChecked: () => void;
};

export function AdminClient({ pendingTransactions, onTransactionChecked }: AdminClientProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleCheck = (id: string) => {
    startTransition(async () => {
      const result = await markTransactionAsChecked(id);
      if (result.success) {
        toast({ title: 'Success', description: result.message });
        onTransactionChecked();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.message,
        });
      }
    });
  };

  if (pendingTransactions.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center p-10 gap-4">
        <CheckCircle className="w-16 h-16 text-green-500" />
        <h2 className="text-2xl font-semibold">All Caught Up!</h2>
        <p className="text-muted-foreground">There are no pending transactions to verify.</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingTransactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell>{format(new Date(tx.date), 'dd/MM/yyyy')}</TableCell>
                <TableCell>{tx.clientName}</TableCell>
                <TableCell><Badge variant={tx.type === 'invoicing' ? 'default' : 'secondary'}>{tx.type}</Badge></TableCell>
                <TableCell className="text-right">£{tx.totalAmount.toFixed(2)}</TableCell>
                <TableCell className="text-center">
                  
                    <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleCheck(tx.id!)}>
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4" />}
                        Mark as Checked
                    </Button>
                  
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
