'use client';

import { useState, useEffect, useTransition } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Loader2, CalendarIcon, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/components/auth/session-provider';
import { cn } from '@/lib/utils';
import { operators, TaskSchema, type Task, type TaskType } from '@/lib/types';
import { getTaskTypes, addTaskType, addTask, updateTask } from '@/lib/server-actions-tasks';

type TaskFormDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    taskToEdit?: Task | null;
};

const FormSchema = TaskSchema.omit({ id: true, taskId: true, createdAt: true, history: true });

export function TaskFormDialog({ isOpen, onClose, onSuccess, taskToEdit }: TaskFormDialogProps) {
    const [isPending, startTransition] = useTransition();
    const { operator } = useSession();
    const { toast } = useToast();
    const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
    const [isAddTypeOpen, setIsAddTypeOpen] = useState(false);
    const [newTypeName, setNewTypeName] = useState('');
    const [note, setNote] = useState('');

    const form = useForm<z.infer<typeof FormSchema>>({
        resolver: zodResolver(FormSchema),
    });

    useEffect(() => {
        getTaskTypes().then(setTaskTypes);
    }, []);

    useEffect(() => {
        if (isOpen) {
            if (taskToEdit) {
                form.reset({
                    ...taskToEdit,
                    completionDate: taskToEdit.completionDate ? new Date(taskToEdit.completionDate) : null,
                });
            } else {
                form.reset({
                    createdBy: operator!,
                    assignedTo: operator!,
                    details: '',
                    type: '',
                    completionDate: null,
                    status: 'To Do',
                });
            }
            setNote('');
        }
    }, [isOpen, taskToEdit, operator, form]);

    const onSubmit = (data: z.infer<typeof FormSchema>) => {
        startTransition(async () => {
            const result = taskToEdit
                ? await updateTask(taskToEdit.id!, data, operator!, note)
                : await addTask(data);

            if (result.success) {
                toast({ title: 'Success', description: result.message });
                onSuccess();
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.message });
            }
        });
    };

    const handleAddType = async () => {
        if (!newTypeName.trim()) return;
        const result = await addTaskType(newTypeName.trim());
        if (result.success) {
            toast({ title: 'Success', description: 'New type added.' });
            setTaskTypes(prev => [...prev, { id: result.id, name: newTypeName.trim() }]);
            form.setValue('type', newTypeName.trim());
            setNewTypeName('');
            setIsAddTypeOpen(false);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.message });
        }
    };

    return (
        <>
            <AlertDialog open={isAddTypeOpen} onOpenChange={setIsAddTypeOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Add New Task Type</AlertDialogTitle>
                        <AlertDialogDescription>
                            Enter the name for the new task type you want to create.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Input
                        value={newTypeName}
                        onChange={(e) => setNewTypeName(e.target.value)}
                        placeholder="e.g., Design, Follow-up, Urgent"
                    />
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleAddType}>Add Type</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{taskToEdit ? 'Edit Task' : 'Create Task/Request'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="details">Task Details</Label>
                            <Textarea id="details" {...form.register('details')} />
                            {form.formState.errors.details && <p className="text-sm text-destructive">{form.formState.errors.details.message}</p>}
                        </div>

                        {taskToEdit && (
                             <div className="space-y-2">
                                <Label htmlFor="note">Add Note (for internal communication)</Label>
                                <Textarea 
                                    id="note" 
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder="Add a new note here..."
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Task Type</Label>
                                <div className="flex gap-2">
                                    <Controller
                                        name="type"
                                        control={form.control}
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <SelectTrigger><SelectValue placeholder="Select a type..." /></SelectTrigger>
                                                <SelectContent>
                                                    {taskTypes.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                    <Button type="button" variant="outline" size="icon" onClick={() => setIsAddTypeOpen(true)}><Plus className="h-4 w-4" /></Button>
                                </div>
                                {form.formState.errors.type && <p className="text-sm text-destructive">{form.formState.errors.type.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label>Assigned To</Label>
                                <Controller
                                    name="assignedTo"
                                    control={form.control}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>{operators.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}</SelectContent>
                                        </Select>
                                    )}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Due Date</Label>
                                <Controller
                                    name="completionDate"
                                    control={form.control}
                                    render={({ field }) => (
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !field.value && 'text-muted-foreground')}>
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent>
                                        </Popover>
                                    )}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {taskToEdit ? 'Save Changes' : 'Create Task'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
