'use client';

import { useState, useTransition, useEffect } from 'react';
import { format } from 'date-fns';
import { enGB } from 'date-fns/locale';
import { 
  Calendar as CalendarIcon, 
  Loader2, 
  Banknote, 
  CreditCard, 
  Landmark, 
  Building2, 
  Plane, 
  Check, 
  Receipt,
  User,
  FileText,
  Percent,
  Plus
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/components/auth/session-provider';
import { addTransaction } from '@/lib/server-actions';
import { type PaymentMethod, type Transaction } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

type TillFormProps = {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onTransactionAdded?: (transaction: Transaction) => void;
};

export function TillForm({ selectedDate, onDateChange, onTransactionAdded }: TillFormProps) {
  const { operators: dynamicOperators, operator: currentSessionOperator } = useSession();
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  // Form states
  const [clientName, setClientName] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [amount, setAmount] = useState<string>(''); // Pre-VAT unit price or line price
  const [vatApplied, setVatApplied] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [operator, setOperator] = useState<string>(currentSessionOperator || 'PTMGH');

  useEffect(() => {
    if (currentSessionOperator) {
      setOperator(currentSessionOperator);
    }
  }, [currentSessionOperator]);

  // Derived financial computations
  const numQty = Math.max(1, Number(quantity) || 1);
  const netAmount = Math.max(0, Number(amount) || 0); // Net price entered by user
  const unitPrice = numQty > 0 ? Number((netAmount / numQty).toFixed(2)) : netAmount;
  const vatAmount = vatApplied ? Number((netAmount * 0.20).toFixed(2)) : 0;
  const totalAmount = Number((netAmount + vatAmount).toFixed(2));

  const paymentMethodOptions: { id: PaymentMethod; label: string; icon: typeof Banknote; color: string }[] = [
    { id: 'Cash', label: 'Cash', icon: Banknote, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300' },
    { id: 'Card Payment', label: 'Card', icon: CreditCard, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-300' },
    { id: 'Bank Transfer', label: 'Bank', icon: Landmark, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40 border-purple-300' },
    { id: 'ST Bank Transfer', label: 'ST Bank', icon: Building2, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-300' },
    { id: 'AIR Bank Transfer', label: 'AIR Bank', icon: Plane, color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/40 border-sky-300' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!jobDescription.trim()) {
      toast({
        variant: 'destructive',
        title: 'Job Description Required',
        description: 'Please enter a description for the sale/job.',
      });
      return;
    }

    if (netAmount <= 0) {
      toast({
        variant: 'destructive',
        title: 'Net Price Required',
        description: 'Please enter a valid net price greater than 0.',
      });
      return;
    }

    const finalClient = clientName.trim() ? clientName.trim() : 'Walking Client';

    startTransition(async () => {
      const payload = {
        type: 'non-invoicing' as const,
        date: selectedDate,
        clientName: finalClient,
        jobDescription: jobDescription.trim(),
        quantity: numQty,
        unitPrice: unitPrice,
        amount: netAmount, // Net price (pre-VAT)
        vatApplied: vatApplied,
        totalAmount: totalAmount,
        paidAmount: totalAmount,
        dueAmount: 0,
        paymentMethod: paymentMethod,
        operator: operator || 'PTMGH',
        reference: '',
      };

      const result = await addTransaction(payload);

      if (result.success && result.transaction) {
        toast({
          title: 'Sale Logged to Till',
          description: `£${totalAmount.toFixed(2)} recorded via ${paymentMethod} (${jobDescription.trim()}).`,
        });

        // Reset inputs for next sale while preserving date & payment method
        setClientName('');
        setJobDescription('');
        setQuantity(1);
        setAmount('');
        setVatApplied(false);

        if (onTransactionAdded) {
          onTransactionAdded(result.transaction);
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to record sale',
          description: result.message || 'An error occurred.',
        });
      }
    });
  };

  return (
    <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-md overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm">
      <CardHeader className="pb-4 pt-6 px-6 sm:px-8 border-b border-slate-100 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-sm">
                <Plus className="h-5 w-5" />
              </span>
              Record New Till Sale
            </CardTitle>
            <CardDescription className="text-xs mt-1 text-slate-500">
              Quickly record direct walk-in sales without needing a pre-existing Job ID.
            </CardDescription>
          </div>

          {/* Date Picker (Prefilled system date) */}
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl h-10 px-3.5 border-slate-200 dark:border-slate-700 font-semibold text-xs shadow-sm bg-white dark:bg-slate-900"
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-indigo-600" />
                  {format(selectedDate, 'EEE, dd MMM yyyy', { locale: enGB })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-2xl" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && onDateChange(d)}
                  locale={enGB}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onDateChange(new Date())}
              className="rounded-xl h-10 px-3 text-xs font-semibold"
            >
              Today
            </Button>
          </div>
        </div>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="p-6 sm:p-8 space-y-6">
          {/* Row 1: Client Name/Phone & Job Description */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            <div className="md:col-span-5 space-y-2">
              <Label htmlFor="clientName" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-indigo-500" />
                Client Name / Phone number
              </Label>
              <Input
                id="clientName"
                placeholder="Walking Client (or Name / Phone)"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="rounded-xl h-11 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900 font-medium"
              />
            </div>

            <div className="md:col-span-7 space-y-2">
              <Label htmlFor="jobDescription" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-indigo-500" />
                Job Description *
              </Label>
              <Input
                id="jobDescription"
                placeholder="e.g. 500 Business Cards 400gsm Matt, A3 Poster, Banner..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className="rounded-xl h-11 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900 font-medium"
                required
              />
            </div>
          </div>

          {/* Row 2: Qty, Amount, VAT 20%, Operator */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-5 items-end">
            {/* Quantity */}
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="quantity" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Qty
              </Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="rounded-xl h-11 font-bold text-center bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
              />
            </div>

            {/* Price / Amount */}
            <div className="md:col-span-3 space-y-2">
              <Label htmlFor="amount" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Net Price (£) *
              </Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                  £
                </span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="rounded-xl h-11 pl-8 font-black text-base bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                  required
                />
              </div>
            </div>

            {/* VAT 20% Add or No */}
            <div className="md:col-span-4">
              <div className={cn(
                "flex items-center justify-between p-2.5 px-4 rounded-xl border transition-all duration-200 h-11",
                vatApplied 
                  ? "bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800" 
                  : "bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
              )}>
                <div className="flex items-center gap-2">
                  <Percent className={cn("h-4 w-4", vatApplied ? "text-indigo-600" : "text-slate-400")} />
                  <Label htmlFor="vatApplied" className="text-xs font-bold cursor-pointer">
                    Add VAT 20%
                  </Label>
                </div>
                <Switch
                  id="vatApplied"
                  checked={vatApplied}
                  onCheckedChange={setVatApplied}
                />
              </div>
            </div>

            {/* Operator */}
            <div className="md:col-span-3 space-y-2">
              <Label htmlFor="operator" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Operator
              </Label>
              <Select value={operator} onValueChange={setOperator}>
                <SelectTrigger id="operator" className="rounded-xl h-11 bg-slate-50/50 dark:bg-slate-800/50 font-semibold border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder="Operator" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {dynamicOperators.map((op) => (
                    <SelectItem key={op.id} value={op.id} className="font-medium">
                      {op.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: Payment Method Selection (Bank, Cash, Card, ST, AIR) */}
          <div className="space-y-2.5 pt-1">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Payment Method *
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {paymentMethodOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = paymentMethod === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPaymentMethod(opt.id)}
                    className={cn(
                      "flex items-center justify-center gap-2 py-3 px-3 rounded-2xl border-2 font-bold text-xs transition-all duration-200 shadow-sm",
                      isSelected
                        ? `${opt.color} ring-2 ring-offset-1 ring-indigo-500 scale-[1.02] shadow-md`
                        : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{opt.label}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 ml-auto" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 4: Summary Bar & Submit Button */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-slate-50 via-indigo-50/30 to-purple-50/30 dark:from-slate-800/50 dark:via-indigo-950/20 dark:to-purple-950/20 border border-slate-200/80 dark:border-slate-700">
            {/* Live Financial Breakdown */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Net Price</span>
                <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                  £{netAmount.toFixed(2)}
                </span>
                {numQty > 1 && netAmount > 0 && (
                  <span className="block text-[10px] text-slate-400 font-normal">
                    (£{unitPrice.toFixed(2)} / each)
                  </span>
                )}
              </div>
              <div className="h-7 w-px bg-slate-200 dark:bg-slate-700" />
              <div>
                <span className="text-slate-400 block font-medium">VAT (20%)</span>
                <span className={cn("font-bold text-sm", vatApplied ? "text-indigo-600" : "text-slate-500")}>
                  £{vatAmount.toFixed(2)}
                </span>
              </div>
              <div className="h-7 w-px bg-slate-200 dark:bg-slate-700" />
              <div>
                <span className="text-slate-400 block font-medium">Grand Total</span>
                <span className="font-extrabold text-xl text-slate-950 dark:text-white">
                  £{totalAmount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isPending || netAmount <= 0}
              className="rounded-xl h-12 px-8 font-black text-sm bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all duration-300"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <Receipt className="mr-2 h-4 w-4" />
                  Record Sale • £{totalAmount.toFixed(2)}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </form>
    </Card>
  );
}
