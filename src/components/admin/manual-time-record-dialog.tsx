'use client';

import { useState, useTransition } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Loader2, CalendarIcon, Trash2, PlusCircle } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { UpdateTimeRecordSchema, operators, timeRecordStatus, type Operator } from '@/lib/types';
import { createManualTimeRecord } from '@/lib/server-actions-attendance';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

type ManualTimeRecordDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

type FormValues = z.infer<typeof UpdateTimeRecordSchema> & { operator: Operator };

const ExtendedSchema = UpdateTimeRecordSchema.extend({
    operator: z.enum(operators),
});

const DateTimePicker = ({ value, onChange }: { value?: Date | null, onChange: (date: Date) => void }) => {
    const [date, setDate] = useState<Date | undefined>(value || undefined);
    const [time, setTime] = useState(value ? format(value, 'HH:mm') : '09:00');

    const handleDateTimeChange = (newDate: Date | undefined, newTime: string) => {
        if (!newDate) return;
        
        const [hours, minutes] = newTime.split(':').map(Number);
        const combinedDate = new Date(newDate);
        combinedDate.setHours(hours, minutes, 0, 0);
        
        setDate(combinedDate);
        onChange(combinedDate);
    };

    return (
        <div className="flex gap-2">
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[150px] justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, 'dd/MM/yy') : <span>Pick a date</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(d) => handleDateTimeChange(d, time)}
                        initialFocus
                    />
                </PopoverContent>
            </Popover>
            <Input
                type="time"
                value={time}
                onChange={(e) => {
                    setTime(e.target.value);
                    handleDateTimeChange(date, e.target.value);
                }}
                className="w-[100px]"
            />
        </div>
    );
};

export function ManualTimeRecordDialog({ isOpen, onClose, onSuccess }: ManualTimeRecordDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(ExtendedSchema),
    defaultValues: {
        operator: 'PTMGH',
        clockInTime: new Date(),
        clockOutTime: new Date(),
        status: 'clocked-out',
        breaks: [],
    }
  });
  
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "breaks",
  });

  const onSubmit = (data: FormValues) => {
    const { operator, ...recordData } = data;
    startTransition(async () => {
      const result = await createManualTimeRecord(operator, recordData);
      if (result.success) {
        toast({ title: 'Success', description: 'Manual time record created.' });
        onSuccess();
        form.reset();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Manual Time Record</DialogTitle>
          <DialogDescription>
            Create an attendance record for an operator who forgot to clock in/out.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4 max-h-[70vh] overflow-y-auto pr-4">
            <div className="space-y-2">
                <Label>Operator</Label>
                <Controller
                    name="operator"
                    control={form.control}
                    render={({ field }) => (
                         <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {operators.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )}
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label>Clock In Time</Label>
                    <Controller
                        name="clockInTime"
                        control={form.control}
                        render={({ field }) => <DateTimePicker value={field.value} onChange={field.onChange} />}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Clock Out Time</Label>
                    <Controller
                        name="clockOutTime"
                        control={form.control}
                        render={({ field }) => <DateTimePicker value={field.value} onChange={field.onChange} />}
                    />
                </div>
            </div>

            <div className="space-y-4">
                <Label>Breaks</Label>
                {fields.map((field, index) => (
                    <div key={field.id} className="flex items-center gap-2">
                         <Controller
                            name={`breaks.${index}.startTime`}
                            control={form.control}
                            render={({ field }) => <DateTimePicker value={field.value} onChange={field.onChange} />}
                        />
                         <Controller
                            name={`breaks.${index}.endTime`}
                            control={form.control}
                            render={({ field }) => <DateTimePicker value={field.value} onChange={field.onChange} />}
                        />
                        <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => append({ startTime: new Date(), endTime: new Date() })}>
                    <PlusCircle className="h-4 w-4 mr-2" /> Add Break
                </Button>
            </div>
             <div className="space-y-2">
                <Label>Status</Label>
                <Controller
                    name="status"
                    control={form.control}
                    render={({ field }) => (
                         <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {timeRecordStatus.map(s => <SelectItem key={s} value={s}>{s.replace('-', ' ')}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )}
                />
            </div>


          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Record
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
