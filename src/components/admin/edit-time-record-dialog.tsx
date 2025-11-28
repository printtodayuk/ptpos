
'use client';

import { useEffect, useState, useTransition } from 'react';
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
import { type TimeRecord, UpdateTimeRecordSchema, timeRecordStatus, type TimeRecordStatus } from '@/lib/types';
import { updateTimeRecord } from '@/lib/server-actions-attendance';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

type EditTimeRecordDialogProps = {
  record: TimeRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

type FormValues = z.infer<typeof UpdateTimeRecordSchema>;

const DateTimePicker = ({ value, onChange }: { value?: Date | null, onChange: (date: Date) => void }) => {
    const [date, setDate] = useState<Date | undefined>(value || undefined);
    const [time, setTime] = useState(value ? format(value, 'HH:mm') : '00:00');

    useEffect(() => {
        if (value) {
            setDate(value);
            setTime(format(value, 'HH:mm'));
        }
    }, [value]);

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

export function EditTimeRecordDialog({ record, isOpen, onClose, onSuccess }: EditTimeRecordDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(UpdateTimeRecordSchema),
  });
  
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "breaks",
  });

  useEffect(() => {
    if (record) {
      form.reset({
        ...record,
        clockInTime: new Date(record.clockInTime),
        clockOutTime: record.clockOutTime ? new Date(record.clockOutTime) : null,
        status: record.status,
        breaks: record.breaks.map(b => ({
            startTime: new Date(b.startTime),
            endTime: b.endTime ? new Date(b.endTime) : null,
        }))
      });
    }
  }, [record, form]);

  const onSubmit = (data: FormValues) => {
    if (!record?.id) return;
    startTransition(async () => {
      const result = await updateTimeRecord(record.id, data);
      if (result.success) {
        toast({ title: 'Success', description: 'Time record updated successfully.' });
        onSuccess();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.message || 'Failed to update record.',
        });
      }
    });
  };
  
  if (!record) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Time Record for {record.operator}</DialogTitle>
          <DialogDescription>
            Date: {format(new Date(record.clockInTime), 'PPP')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4 max-h-[70vh] overflow-y-auto pr-4">
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
                <Button type="button" variant="outline" size="sm" onClick={() => append({ startTime: new Date(), endTime: null })}>
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
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
