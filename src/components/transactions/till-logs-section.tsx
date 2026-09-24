'use client';

import { useState, useMemo, useTransition } from 'react';
import { format } from 'date-fns';
import { enGB } from 'date-fns/locale';
import { 
  Banknote, 
  CreditCard, 
  Landmark, 
  Building2, 
  Plane, 
  Calendar as CalendarIcon, 
  Search, 
  FilePlus2, 
  Printer, 
  Trash2, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Receipt
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/components/auth/session-provider';
import { createJobSheetFromTillLogs } from '@/lib/server-actions-jobs';
import { deleteTransaction } from '@/lib/server-actions';
import { getJobSheetByJobId } from '@/lib/server-actions-jobs';
import type { Transaction, PaymentMethod, JobSheet } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ReceiptDialog } from './receipt-dialog';
import { JobSheetViewDialog } from '../jobs/job-sheet-view-dialog';

type TillLogsSectionProps = {
  selectedDate: Date;
  transactions: Transaction[];
  isLoading: boolean;
  onRefresh: () => void;
};

type PaymentSectionConfig = {
  id: PaymentMethod;
  name: string;
  icon: typeof Banknote;
  badgeClass: string;
  cardBorderClass: string;
  headerBgClass: string;
  btnClass: string;
};

const PAYMENT_SECTIONS: PaymentSectionConfig[] = [
  {
    id: 'Cash',
    name: 'Cash Sales',
    icon: Banknote,
    badgeClass: 'bg-emerald-600 text-white',
    cardBorderClass: 'border-emerald-200/80 dark:border-emerald-900/60',
    headerBgClass: 'bg-emerald-50/60 dark:bg-emerald-950/30',
    btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20',
  },
  {
    id: 'Card Payment',
    name: 'Card Payments',
    icon: CreditCard,
    badgeClass: 'bg-blue-600 text-white',
    cardBorderClass: 'border-blue-200/80 dark:border-blue-900/60',
    headerBgClass: 'bg-blue-50/60 dark:bg-blue-950/30',
    btnClass: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20',
  },
  {
    id: 'Bank Transfer',
    name: 'Bank Transfers',
    icon: Landmark,
    badgeClass: 'bg-purple-600 text-white',
    cardBorderClass: 'border-purple-200/80 dark:border-purple-900/60',
    headerBgClass: 'bg-purple-50/60 dark:bg-purple-950/30',
    btnClass: 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20',
  },
  {
    id: 'ST Bank Transfer',
    name: 'Sign Today (ST) Transfers',
    icon: Building2,
    badgeClass: 'bg-amber-600 text-white',
    cardBorderClass: 'border-amber-200/80 dark:border-amber-900/60',
    headerBgClass: 'bg-amber-50/60 dark:bg-amber-950/30',
    btnClass: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20',
  },
  {
    id: 'AIR Bank Transfer',
    name: 'AIR Bank Transfers',
    icon: Plane,
    badgeClass: 'bg-sky-600 text-white',
    cardBorderClass: 'border-sky-200/80 dark:border-sky-900/60',
    headerBgClass: 'bg-sky-50/60 dark:bg-sky-950/30',
    btnClass: 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-600/20',
  },
];

export function TillLogsSection({ selectedDate, transactions, isLoading, onRefresh }: TillLogsSectionProps) {
  const { operator: sessionOperator } = useSession();
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState<'All' | PaymentMethod>('All');
  const [searchTerm, setSearchTerm] = useState('');

  // Dialog states
  const [createJidSection, setCreateJidSection] = useState<PaymentSectionConfig | null>(null);
  const [customClientName, setCustomClientName] = useState('Walking Client');
  const [isCreatingJid, startCreateJidTransition] = useTransition();

  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  const [receiptTransaction, setReceiptTransaction] = useState<Transaction | null>(null);
  const [viewingJobSheet, setViewingJobSheet] = useState<JobSheet | null>(null);
  const [isFetchingJob, startFetchingJobTransition] = useTransition();

  // Filter transactions by search term
  const searchedTransactions = useMemo(() => {
    if (!searchTerm.trim()) return transactions;
    const term = searchTerm.toLowerCase().trim();
    return transactions.filter(t => {
      const client = (t.clientName || '').toLowerCase();
      const desc = (t.jobDescription || '').toLowerCase();
      const jid = (t.jid || '').toLowerCase();
      const tid = (t.transactionId || '').toLowerCase();
      const op = (t.operator || '').toLowerCase();
      return client.includes(term) || desc.includes(term) || jid.includes(term) || tid.includes(term) || op.includes(term);
    });
  }, [transactions, searchTerm]);

  // Group transactions by payment method
  const groupedSections = useMemo(() => {
    return PAYMENT_SECTIONS.map(config => {
      const list = searchedTransactions.filter(t => t.paymentMethod === config.id);
      const unassignedList = list.filter(t => !t.jid || t.jid.trim() === '');
      const totalAmount = list.reduce((acc, t) => acc + (Number(t.paidAmount) || Number(t.totalAmount) || 0), 0);
      const unassignedTotal = unassignedList.reduce((acc, t) => acc + (Number(t.paidAmount) || Number(t.totalAmount) || 0), 0);

      return {
        config,
        transactions: list,
        unassignedTransactions: unassignedList,
        totalAmount,
        unassignedTotal,
      };
    });
  }, [searchedTransactions]);

  // Filter sections based on active tab
  const visibleSections = useMemo(() => {
    if (activeFilter === 'All') {
      return groupedSections;
    }
    return groupedSections.filter(s => s.config.id === activeFilter);
  }, [groupedSections, activeFilter]);

  // Handle open create JID confirmation
  const handleOpenCreateJid = (config: PaymentSectionConfig) => {
    setCreateJidSection(config);
    setCustomClientName('Walking Client');
  };

  // Handle confirm create JID
  const handleConfirmCreateJid = () => {
    if (!createJidSection) return;

    const sectionData = groupedSections.find(s => s.config.id === createJidSection.id);
    if (!sectionData || sectionData.unassignedTransactions.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No unassigned sales',
        description: 'There are no unassigned sales in this section to create a Job Sheet.',
      });
      return;
    }

    const txIds = sectionData.unassignedTransactions.map(t => t.id!).filter(Boolean);

    startCreateJidTransition(async () => {
      const result = await createJobSheetFromTillLogs({
        transactionIds: txIds,
        paymentMethod: createJidSection.id,
        date: selectedDate,
        operator: sessionOperator || 'PTTill',
        clientName: customClientName.trim() || 'Walking Client',
      });

      if (result.success && result.jobSheet) {
        toast({
          title: 'Job Sheet Created!',
          description: `${result.jobId} created with ${sectionData.unassignedTransactions.length} items.`,
        });
        setCreateJidSection(null);
        onRefresh();

        // Open newly created Job Sheet preview dialog
        setViewingJobSheet(result.jobSheet);
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to create Job Sheet',
          description: result.message || 'An error occurred.',
        });
      }
    });
  };

  // Handle delete transaction
  const handleConfirmDelete = () => {
    if (!transactionToDelete?.id) return;

    startDeleteTransition(async () => {
      const result = await deleteTransaction(transactionToDelete.id!);
      if (result.success) {
        toast({ title: 'Deleted', description: 'Transaction deleted successfully.' });
        setTransactionToDelete(null);
        onRefresh();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
    });
  };

  // Handle click on existing JID badge
  const handleViewExistingJid = (jidStr: string) => {
    startFetchingJobTransition(async () => {
      const sheet = await getJobSheetByJobId(jidStr);
      if (sheet) {
        setViewingJobSheet(sheet);
      } else {
        toast({ variant: 'destructive', title: 'Not Found', description: `Job Sheet ${jidStr} could not be found.` });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        {/* Left: Section Title & Date Indicator */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 border border-indigo-200/60 dark:border-indigo-800/40">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Till Sales Logs
              <Badge variant="outline" className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {transactions.length} {transactions.length === 1 ? 'Entry' : 'Entries'}
              </Badge>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Sales for {format(selectedDate, 'EEEE, dd MMMM yyyy', { locale: enGB })}
            </p>
          </div>
        </div>

        {/* Right: Search Filter */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by client, description, JID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 rounded-xl h-10 bg-slate-50/70 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-xs font-medium"
          />
        </div>
      </div>

      {/* Payment Method Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveFilter('All')}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2",
            activeFilter === 'All'
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50"
          )}
        >
          <span>All Sales</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
            {transactions.length}
          </span>
        </button>

        {PAYMENT_SECTIONS.map((sec) => {
          const Icon = sec.icon;
          const isSelected = activeFilter === sec.id;
          const count = transactions.filter(t => t.paymentMethod === sec.id).length;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => setActiveFilter(sec.id)}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 border",
                isSelected
                  ? `${sec.btnClass} border-transparent shadow-md scale-[1.02]`
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{sec.name}</span>
              <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px]",
                isSelected ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sections List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white/50 dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-3" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Loading Till logs...</p>
        </div>
      ) : transactions.length === 0 ? (
        <Card className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center bg-white/50 dark:bg-slate-900/50">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center mb-3">
            <Receipt className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Sales Recorded for this Date</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Use the form above to record cash, card, or bank sales for {format(selectedDate, 'dd/MM/yyyy')}.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {visibleSections.map(({ config, transactions: secTxs, unassignedTransactions, totalAmount, unassignedTotal }) => {
            const Icon = config.icon;
            const hasUnassigned = unassignedTransactions.length > 0;

            // If filtering by "All", we only show sections that have transactions
            if (activeFilter === 'All' && secTxs.length === 0) {
              return null;
            }

            return (
              <Card 
                key={config.id} 
                className={cn(
                  "rounded-3xl border overflow-hidden shadow-sm transition-all duration-300 bg-white/95 dark:bg-slate-900/95",
                  config.cardBorderClass
                )}
              >
                {/* Section Header */}
                <CardHeader className={cn("p-5 px-6 sm:px-8 border-b", config.headerBgClass)}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Left: Icon, Section Title & Totals */}
                    <div className="flex items-center gap-3.5">
                      <div className={cn("p-2.5 rounded-2xl shadow-sm border", config.badgeClass)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5">
                          <CardTitle className="text-base font-black text-slate-900 dark:text-slate-100">
                            {config.name}
                          </CardTitle>
                          <Badge className={cn("text-xs font-bold px-2 py-0.5", config.badgeClass)}>
                            £{totalAmount.toFixed(2)}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs text-slate-500 font-medium mt-0.5">
                          {secTxs.length} {secTxs.length === 1 ? 'transaction' : 'transactions'} • {unassignedTransactions.length} unassigned
                        </CardDescription>
                      </div>
                    </div>

                    {/* Right: Create JID Action Button */}
                    <div>
                      {hasUnassigned ? (
                        <Button
                          onClick={() => handleOpenCreateJid(config)}
                          className={cn(
                            "rounded-xl h-10 px-4 font-bold text-xs shadow-md transition-all duration-200",
                            config.btnClass
                          )}
                        >
                          <FilePlus2 className="h-4 w-4 mr-2 shrink-0" />
                          Create JID ({unassignedTransactions.length} items • £{unassignedTotal.toFixed(2)})
                        </Button>
                      ) : secTxs.length > 0 ? (
                        <Badge variant="outline" className="h-9 px-3.5 rounded-xl border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4" />
                          All JIDs Created
                        </Badge>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">No sales</span>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {/* Section Table */}
                <CardContent className="p-0">
                  {secTxs.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 font-medium">
                      No transactions recorded under {config.name} for this date.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-[11px] font-bold uppercase text-slate-400">
                            <TableHead className="w-[80px]">Time</TableHead>
                            <TableHead className="w-[180px]">Client / Phone</TableHead>
                            <TableHead>Job Description</TableHead>
                            <TableHead className="w-[60px] text-center">Qty</TableHead>
                            <TableHead className="w-[100px] text-right">Unit Price</TableHead>
                            <TableHead className="w-[90px] text-center">VAT</TableHead>
                            <TableHead className="w-[110px] text-right">Total (£)</TableHead>
                            <TableHead className="w-[100px] text-center">Operator</TableHead>
                            <TableHead className="w-[120px] text-center">JID Status</TableHead>
                            <TableHead className="w-[80px] text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {secTxs.map((t) => {
                            const timeStr = t.date ? format(new Date(t.date), 'HH:mm') : '--:--';
                            const qty = Number(t.quantity) > 0 ? Number(t.quantity) : 1;
                            const unitPrice = t.unitPrice ? Number(t.unitPrice) : (Number(t.amount) / qty);
                            const total = Number(t.paidAmount) || Number(t.totalAmount) || 0;
                            const hasJid = Boolean(t.jid && t.jid.trim());

                            return (
                              <TableRow key={t.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors text-xs font-medium">
                                <TableCell className="font-mono text-slate-500 text-[11px]">
                                  {timeStr}
                                </TableCell>
                                <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                                  {t.clientName || 'Walking Client'}
                                </TableCell>
                                <TableCell className="font-medium text-slate-700 dark:text-slate-300 max-w-[280px] truncate" title={t.jobDescription || ''}>
                                  {t.jobDescription || '--'}
                                </TableCell>
                                <TableCell className="text-center font-bold text-slate-800 dark:text-slate-200">
                                  {qty}
                                </TableCell>
                                <TableCell className="text-right font-mono text-slate-600 dark:text-slate-400">
                                  £{unitPrice.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-center">
                                  {t.vatApplied ? (
                                    <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-[10px] px-1.5 font-bold shadow-none">
                                      +20%
                                    </Badge>
                                  ) : (
                                    <span className="text-[11px] text-slate-400 font-medium">0%</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-black text-sm text-slate-950 dark:text-white">
                                  £{total.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="secondary" className="font-mono text-[10px] px-1.5">
                                    {t.operator || 'PT'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  {hasJid ? (
                                    <button
                                      type="button"
                                      onClick={() => handleViewExistingJid(t.jid!)}
                                      className="inline-flex items-center gap-1 font-black text-xs px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm"
                                      title="View Job Sheet"
                                    >
                                      <span>{t.jid}</span>
                                      <ExternalLink className="h-3 w-3" />
                                    </button>
                                  ) : (
                                    <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 text-[11px] font-bold">
                                      Pending JID
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setReceiptTransaction(t)}
                                      className="h-8 w-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-indigo-600"
                                      title="Print Receipt"
                                    >
                                      <Printer className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setTransactionToDelete(t)}
                                      className="h-8 w-8 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600"
                                      title="Delete"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Confirmation Dialog for Creating JID */}
      <Dialog open={!!createJidSection} onOpenChange={(open) => !open && setCreateJidSection(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6 sm:p-7">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center mb-2 shadow-sm">
              <Sparkles className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center text-lg font-black">
              Create JID for {createJidSection?.name}
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-slate-500">
              This will automatically generate a new Job Sheet containing all unassigned sales in this section.
            </DialogDescription>
          </DialogHeader>

          {createJidSection && (() => {
            const secData = groupedSections.find(s => s.config.id === createJidSection.id);
            const count = secData?.unassignedTransactions.length || 0;
            const total = secData?.unassignedTotal || 0;

            return (
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Section:</span>
                    <span className="font-bold">{createJidSection.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Date:</span>
                    <span className="font-bold">{format(selectedDate, 'dd/MM/yyyy')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Unassigned Items:</span>
                    <span className="font-bold text-indigo-600">{count} sales</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2 text-sm">
                    <span className="font-bold text-slate-700 dark:text-slate-300">Total Value:</span>
                    <span className="font-black text-slate-900 dark:text-white">£{total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="customClient" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Client Name for JID
                  </Label>
                  <Input
                    id="customClient"
                    value={customClientName}
                    onChange={(e) => setCustomClientName(e.target.value)}
                    placeholder="Walking Client"
                    className="rounded-xl h-11 text-xs font-semibold"
                  />
                  <p className="text-[11px] text-slate-400">
                    Default is &quot;Walking Client&quot;. You can modify this if needed.
                  </p>
                </div>
              </div>
            );
          })()}

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateJidSection(null)}
              className="rounded-xl font-bold text-xs"
              disabled={isCreatingJid}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmCreateJid}
              disabled={isCreatingJid}
              className="rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isCreatingJid ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating JID...
                </>
              ) : (
                'Create JID Now'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!transactionToDelete} onOpenChange={(open) => !open && setTransactionToDelete(null)}>
        <AlertDialogContent className="rounded-3xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold">Delete Transaction?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete transaction {transactionToDelete?.transactionId}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl text-xs font-bold">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Receipt Dialog */}
      <ReceiptDialog
        transaction={receiptTransaction}
        isOpen={!!receiptTransaction}
        onClose={() => setReceiptTransaction(null)}
      />

      {/* Job Sheet View Dialog (for clicking on JID badge or immediately after creating JID) */}
      <JobSheetViewDialog
        jobSheet={viewingJobSheet}
        isOpen={!!viewingJobSheet}
        onClose={() => setViewingJobSheet(null)}
      />
    </div>
  );
}
