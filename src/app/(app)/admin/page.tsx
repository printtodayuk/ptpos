
'use client';

import { useEffect, useState, useCallback, useTransition } from 'react';
import { searchTransactions, deleteTransaction, bulkDeleteTransactions, bulkMarkAsChecked } from '@/lib/server-actions';
import { getCurrentNotice, saveNotice } from '@/lib/server-actions-notices';
import { saveOperator, deleteOperator } from '@/lib/server-actions-operators';
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Search, Trash2, CheckCircle, Edit, Filter, Megaphone, Send, Users, Key, UserPlus, X, ShieldCheck } from 'lucide-react';
import type { Transaction, PaymentMethod } from '@/lib/types';
import { paymentMethods } from '@/lib/types';
import { useDebounce } from '@/hooks/use-debounce';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { TransactionsTable } from '@/components/transactions/transactions-table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { PinLock } from '@/components/admin/pin-lock';
import { EditTransactionDialog } from '@/components/transactions/edit-transaction-dialog';
import { useSession } from '@/components/auth/session-provider';
import { Switch } from '@/components/ui/switch';
import { useFeatures } from '@/components/features/feature-provider';
import { updateAppFeatures } from '@/lib/server-actions-features';
import { AppFeatures } from '@/lib/types';
import { Settings } from 'lucide-react';

const filterablePaymentMethods: ('All' | PaymentMethod)[] = ['All', ...paymentMethods];

export default function AdminPage() {
  const { operator, operators, refreshOperators } = useSession();
  const [newOpId, setNewOpId] = useState('');
  const [newOpPin, setNewOpPin] = useState('');
  const [editingOpId, setEditingOpId] = useState<string | null>(null);
  const [editingOpPin, setEditingOpPin] = useState('');
  const [isAddingOperator, setIsAddingOperator] = useState(false);
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);
  const [operatorToDelete, setOperatorToDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'All' | PaymentMethod>('All');
  const [results, setResults] = useState<Transaction[]>([]);
  const [isSearching, startSearchTransition] = useTransition();
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
  const [isBulkActionPending, startBulkActionTransition] = useTransition();
  const [bulkAction, setBulkAction] = useState<'delete' | 'check' | null>(null);

  // Notice state
  const [noticeContent, setNoticeContent] = useState('');
  const [isSavingNotice, setIsSavingNotice] = useState(false);

  // Features state
  const { features, refreshFeatures, isLoading: featuresLoading } = useFeatures();
  const [isUpdatingFeature, setIsUpdatingFeature] = useState(false);

  const { toast } = useToast();
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const performSearch = useCallback((term: string, payment: 'All' | PaymentMethod) => {
    startSearchTransition(async () => {
      const allResults = await searchTransactions(term, payment === 'All' ? undefined : payment);
      setResults(allResults);
      setSelectedTransactions([]); // Clear selection on new search
    });
  }, []);

  useEffect(() => {
    performSearch(debouncedSearchTerm, paymentFilter);
  }, [debouncedSearchTerm, paymentFilter, performSearch]);

  // Fetch current notice
  useEffect(() => {
    getCurrentNotice().then(n => {
      if (n) setNoticeContent(n.content);
    });
  }, []);

  const handleSaveNotice = async () => {
    if (!operator) return;
    setIsSavingNotice(true);
    const result = await saveNotice(noticeContent, operator);
    setIsSavingNotice(false);
    if (result.success) {
      toast({ title: 'Notice Updated', description: 'The dashboard announcement has been saved.' });
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
  };

  const handleAddOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOpId.trim() || !newOpPin.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please fill in all fields.' });
      return;
    }
    if (newOpPin.trim().length < 4) {
      toast({ variant: 'destructive', title: 'Error', description: 'PIN must be at least 4 digits.' });
      return;
    }
    setIsAddingOperator(true);
    const result = await saveOperator(newOpId, newOpPin);
    setIsAddingOperator(false);
    if (result.success) {
      toast({ title: 'Success', description: result.message });
      setNewOpId('');
      setNewOpPin('');
      await refreshOperators();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOpId || !editingOpPin.trim()) return;
    if (editingOpPin.trim().length < 4) {
      toast({ variant: 'destructive', title: 'Error', description: 'PIN must be at least 4 digits.' });
      return;
    }
    setIsUpdatingPin(true);
    const result = await saveOperator(editingOpId, editingOpPin);
    setIsUpdatingPin(false);
    if (result.success) {
      toast({ title: 'Success', description: `PIN updated for ${editingOpId}.` });
      setEditingOpId(null);
      setEditingOpPin('');
      await refreshOperators();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
  };

  const handleDeleteOperator = async (id: string) => {
    const result = await deleteOperator(id);
    if (result.success) {
      toast({ title: 'Success', description: result.message });
      await refreshOperators();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setOperatorToDelete(null);
  };

  const handleFeatureToggle = async (featureKey: keyof AppFeatures, newValue: boolean) => {
    setIsUpdatingFeature(true);
    const result = await updateAppFeatures({ [featureKey]: newValue });
    setIsUpdatingFeature(false);
    if (result.success) {
      toast({ title: 'Success', description: `Feature ${featureKey} updated successfully.` });
      await refreshFeatures();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
  };

  const handleDeleteRequest = (transaction: Transaction) => {
    setTransactionToDelete(transaction);
  };
  
  const handleEditRequest = (transaction: Transaction) => {
    setTransactionToEdit(transaction);
  };

  const confirmDelete = async () => {
    if (!transactionToDelete) return;

    setIsDeleting(true);
    const result = await deleteTransaction(transactionToDelete.id!);
    setIsDeleting(false);

    if (result.success) {
      toast({ title: 'Success', description: 'Transaction deleted successfully.' });
      performSearch(debouncedSearchTerm, paymentFilter);
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setTransactionToDelete(null);
  };

  const onTransactionChecked = () => {
    performSearch(debouncedSearchTerm, paymentFilter);
  };
  
  const handleUpdateSuccess = () => {
    setTransactionToEdit(null);
    performSearch(debouncedSearchTerm, paymentFilter);
  };

  const handleSelectionChange = (ids: string[]) => {
    setSelectedTransactions(ids);
  };
  
  const handleBulkDelete = () => {
    if (selectedTransactions.length === 0) return;
    setBulkAction('delete');
  };

  const handleBulkCheck = () => {
    if (selectedTransactions.length === 0) return;
    setBulkAction('check');
  };

  const confirmBulkAction = () => {
    if (!bulkAction) return;

    startBulkActionTransition(async () => {
        let result;
        if (bulkAction === 'delete') {
            result = await bulkDeleteTransactions(selectedTransactions);
        } else if (bulkAction === 'check') {
            result = await bulkMarkAsChecked(selectedTransactions);
        }

        if (result?.success) {
            toast({ title: 'Success', description: result.message });
            performSearch(debouncedSearchTerm, paymentFilter);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result?.message || 'An error occurred.' });
        }
        setBulkAction(null);
        setSelectedTransactions([]);
    });
  };

  return (
    <PinLock>
      <AlertDialog open={!!transactionToDelete} onOpenChange={() => setTransactionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the transaction
              with ID <span className="font-bold">{transactionToDelete?.transactionId}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditTransactionDialog
        transaction={transactionToEdit}
        isOpen={!!transactionToEdit}
        onClose={() => setTransactionToEdit(null)}
        onSuccess={handleUpdateSuccess}
      />

      <AlertDialog open={!!operatorToDelete} onOpenChange={() => setOperatorToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the operator account <span className="font-bold">{operatorToDelete}</span>. 
              They will no longer be able to log in to the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => operatorToDelete && handleDeleteOperator(operatorToDelete)}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              Continue & Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog open={!!bulkAction} onOpenChange={() => setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Action</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {bulkAction} {selectedTransactions.length} selected transaction(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkAction} disabled={isBulkActionPending}>
              {isBulkActionPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col gap-6">
        <CardHeader className="p-0">
          <CardTitle>Admin Control Panel</CardTitle>
          <CardDescription>Search, view, and verify all transactions.</CardDescription>
        </CardHeader>

        {/* Feature Management Section */}
        <Card className="border-primary/20 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10 flex flex-row items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Application Features</CardTitle>
              <CardDescription>Enable or disable specific features across the application.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {featuresLoading ? (
              <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { key: 'createJobSheet' as keyof AppFeatures, label: 'Create Job Sheet', description: 'Allow operators to create new Job Sheets.' },
                  { key: 'transactions' as keyof AppFeatures, label: 'Transactions', description: 'Allow processing of non-invoicing and other transactions.' },
                  { key: 'createQuotation' as keyof AppFeatures, label: 'Create Quotation', description: 'Allow creation of new quotations.' },
                  { key: 'createInvoice' as keyof AppFeatures, label: 'Create Invoice', description: 'Allow generation of new invoices.' },
                  { key: 'manageContacts' as keyof AppFeatures, label: 'Manage Contacts', description: 'Allow adding and editing contacts.' },
                  { key: 'attendance' as keyof AppFeatures, label: 'Attendance', description: 'Allow staff to clock in and out.' },
                  { key: 'reports' as keyof AppFeatures, label: 'Reports', description: 'Allow viewing of application reports.' },
                ].map((feature) => (
                  <div key={feature.key} className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                    <div className="space-y-0.5">
                      <Label className="text-base">{feature.label}</Label>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                    <Switch
                      checked={features[feature.key]}
                      onCheckedChange={(checked) => handleFeatureToggle(feature.key, checked)}
                      disabled={isUpdatingFeature}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notice Board Management Section */}
        <Card className="border-primary/20 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10 flex flex-row items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Dashboard Notice Board</CardTitle>
              <CardDescription>Post an announcement that will appear at the top of everyone's dashboard.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notice-content">Notice Content</Label>
              <Textarea 
                id="notice-content"
                placeholder="Type your announcement here... (e.g. Next staff meeting at 2PM today)"
                value={noticeContent}
                onChange={(e) => setNoticeContent(e.target.value)}
                className="min-h-[100px] bg-white border-primary/20"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveNotice} disabled={isSavingNotice} className="bg-primary hover:bg-primary/90 text-white font-semibold">
                {isSavingNotice ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Post Notice
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Staff Access Control & User Creation Section */}
        <Card className="border-primary/20 overflow-hidden shadow-md">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10 flex flex-row items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Staff Access Control & User Creation</CardTitle>
              <CardDescription>Manage active operators, modify their login PINs, or register new operator accounts.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Operator Accounts List (Takes 2 columns on lg) */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-green-600" /> Active Operator Accounts
                </h3>
                <div className="rounded-md border overflow-hidden bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead>
                        <tr className="bg-muted/50 border-b">
                          <th className="p-3 font-semibold text-muted-foreground">Operator ID</th>
                          <th className="p-3 font-semibold text-muted-foreground">App Access PIN</th>
                          <th className="p-3 font-semibold text-muted-foreground text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {operators && operators.length > 0 ? (
                          operators.map((op) => (
                            <tr key={op.id} className="border-b hover:bg-muted/30 transition-colors">
                              <td className="p-3 font-medium text-foreground">
                                {op.id}
                                {op.id === 'PTITAdmin' && (
                                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    Master Admin
                                  </span>
                                )}
                              </td>
                              <td className="p-3 font-mono">
                                {editingOpId === op.id ? (
                                  <form onSubmit={handleUpdatePin} className="flex items-center gap-2">
                                    <Input
                                      type="password"
                                      placeholder="New PIN (4 digits)"
                                      maxLength={4}
                                      value={editingOpPin}
                                      onChange={(e) => setEditingOpPin(e.target.value.replace(/\D/g, ''))}
                                      className="h-8 w-32 text-sm text-center"
                                      autoFocus
                                    />
                                    <Button type="submit" size="icon" className="h-8 w-8 bg-green-600 hover:bg-green-700 text-white" disabled={isUpdatingPin}>
                                      {isUpdatingPin ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                    </Button>
                                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => setEditingOpId(null)}>
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </form>
                                ) : (
                                  <span className="flex items-center gap-1.5 text-muted-foreground">
                                    •••• <span className="text-xs">({op.pin})</span>
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex justify-end gap-1.5">
                                  {editingOpId !== op.id && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => {
                                        setEditingOpId(op.id);
                                        setEditingOpPin(op.pin);
                                      }}
                                      className="h-8 w-8 text-primary hover:text-primary/80"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    disabled={op.id === 'PTITAdmin'}
                                    onClick={() => setOperatorToDelete(op.id)}
                                    className="h-8 w-8 text-destructive hover:text-destructive/80 disabled:opacity-30"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3} className="p-4 text-center text-muted-foreground italic">
                              Loading operator list...
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Create Operator Account Form (Takes 1 column on lg) */}
              <div className="space-y-4 rounded-xl border p-4 bg-muted/30">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-primary" /> Create Operator Account
                </h3>
                <form onSubmit={handleAddOperator} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-op-id">Operator ID / Name</Label>
                    <Input
                      id="new-op-id"
                      placeholder="e.g. PTNEW"
                      value={newOpId}
                      onChange={(e) => setNewOpId(e.target.value.trim().toUpperCase())}
                      className="bg-white border-primary/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-op-pin">App Access PIN</Label>
                    <Input
                      id="new-op-pin"
                      type="password"
                      maxLength={4}
                      placeholder="e.g. 1234"
                      value={newOpPin}
                      onChange={(e) => setNewOpPin(e.target.value.replace(/\D/g, ''))}
                      className="bg-white border-primary/20 text-center tracking-[0.2em] font-mono font-bold"
                    />
                  </div>
                  <Button type="submit" disabled={isAddingOperator} className="w-full bg-primary hover:bg-primary/90 text-white font-semibold">
                    {isAddingOperator ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                    Register Operator
                  </Button>
                </form>
              </div>

            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
             <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <CardTitle>Search Transactions</CardTitle>
                    <CardDescription className="mt-1">
                        Search by ID, client, or description. Leave blank to see all.
                    </CardDescription>
                </div>
                 {selectedTransactions.length > 0 && (
                    <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline">
                        Bulk Actions ({selectedTransactions.length})
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={handleBulkCheck} className="text-green-600 focus:text-green-700">
                            <CheckCircle className="mr-2 h-4 w-4" /> Mark as Checked
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={handleBulkDelete} className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete Selected
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="e.g. TID0002, John Doe, Flyer Design..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10"
                />
              </div>
               <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-auto">
                        <Filter className="mr-2 h-4 w-4" />
                        <span>Filter by: {paymentFilter}</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Payment Method</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup value={paymentFilter} onValueChange={(value) => setPaymentFilter(value as 'All' | PaymentMethod)}>
                        {filterablePaymentMethods.map((method) => (
                            <DropdownMenuRadioItem key={method} value={method}>
                                {method}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="mt-4">
              {isSearching && results.length === 0 ? (
                <div className="flex justify-center items-center p-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className={isSearching ? "opacity-50 pointer-events-none transition-opacity" : ""}>
                  <TransactionsTable
                    transactions={results}
                    onDelete={handleDeleteRequest}
                    onEdit={handleEditRequest}
                    onTransactionChecked={onTransactionChecked}
                    showAdminControls={true}
                    selectable={true}
                    onSelectionChange={handleSelectionChange}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PinLock>
  );
}
