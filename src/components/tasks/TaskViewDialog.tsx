
'use client';

import { useState, useTransition } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { type Task, type TaskHistory, type TaskStatus } from '@/lib/types';
import { Clock, User, MessageSquare, Loader2 } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { updateTask } from '@/lib/server-actions-tasks';
import { useSession } from '@/components/auth/session-provider';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type TaskViewDialogProps = {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

// Helper function to safely convert Firestore Timestamps to JS Dates
const toDate = (timestamp: any): Date | null => {
    if (timestamp instanceof Timestamp) {
        return timestamp.toDate();
    }
    if (timestamp && typeof timestamp.seconds === 'number' && typeof timestamp.nanoseconds === 'number') {
        return new Timestamp(timestamp.seconds, timestamp.nanoseconds).toDate();
    }
    if (timestamp instanceof Date) {
        return timestamp;
    }
    if (typeof timestamp === 'string') {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
            return date;
        }
    }
    return null;
};

const getStatusClass = (status: TaskStatus) => {
    switch (status) {
        case 'To Do': return 'bg-gray-500';
        case 'In Progress': return 'bg-blue-500';
        case 'Done': return 'bg-green-600';
        case 'Cancelled': return 'bg-red-600';
        default: return 'bg-gray-400';
    }
};

export function TaskViewDialog({ task, isOpen, onClose, onSuccess }: TaskViewDialogProps) {
    const [note, setNote] = useState('');
    const [isPending, startTransition] = useTransition();
    const { operator } = useSession();
    const { toast } = useToast();

    if (!task) return null;

    // Filter for notes only and sort them from newest to oldest
    const notes = [...(task.history || [])]
        .filter(entry => entry.action === 'Note Added')
        .sort((a, b) => {
            const dateA = toDate(a.timestamp);
            const dateB = toDate(b.timestamp);
            if (!dateA || !dateB) return 0;
            return dateB.getTime() - dateA.getTime();
        });


    const handleAddNote = () => {
        if (!note.trim() || !operator) return;

        startTransition(async () => {
            const result = await updateTask(task.id!, {}, operator, note);
            if (result.success) {
                toast({ title: 'Success', description: 'Note added.' });
                setNote('');
                onSuccess();
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.message });
            }
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open) {
                onClose();
                setNote(''); // Reset note on close
            }
        }}>
            <DialogContent className="max-w-5xl">
                <DialogHeader>
                    <DialogTitle>Task Details: {task.taskId}</DialogTitle>
                    <DialogDescription>
                        Created by {task.createdBy} on {format(new Date(task.createdAt), 'dd/MM/yyyy')}.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid md:grid-cols-2 gap-8 py-4 max-h-[70vh] overflow-y-auto">
                    {/* Left Column: Details */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Task Details</h3>
                        <div className="p-4 border rounded-lg bg-muted/50 space-y-4 h-full">
                             <div className="grid grid-cols-2 gap-4 text-sm">
                                <div><strong className="text-muted-foreground">Type:</strong><br />{task.type}</div>
                                <div><strong className="text-muted-foreground">Assigned To:</strong><br /><Badge variant="outline">{task.assignedTo}</Badge></div>
                                <div><strong className="text-muted-foreground">Status:</strong><br /><Badge className={cn('text-white', getStatusClass(task.status))}>{task.status}</Badge></div>
                                <div><strong className="text-muted-foreground">Due Date:</strong><br />{task.completionDate ? format(new Date(task.completionDate), 'PPP') : 'N/A'}</div>
                            </div>
                            <div className="pt-2">
                                <strong className="text-muted-foreground">Details:</strong>
                                <p className="text-sm whitespace-pre-wrap">{task.details}</p>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Notes */}
                    <div className="space-y-4 flex flex-col">
                        <h3 className="text-lg font-semibold">Notes</h3>
                        <ScrollArea className="flex-1 pr-4 border rounded-lg p-4">
                             {notes.length > 0 ? (
                                <div className="relative pl-6">
                                    <div className="absolute left-[30px] top-0 h-full w-0.5 bg-border -translate-x-1/2"></div>
                                    {notes.map((entry, index) => {
                                        const timestamp = toDate(entry.timestamp);
                                        return (
                                            <div key={index} className="relative pl-8 mb-6">
                                                <div className="absolute left-[30px] top-1 h-3 w-3 rounded-full bg-amber-500 -translate-x-1/2"></div>
                                                <div className="p-3 rounded-lg border bg-amber-50 border-amber-200">
                                                    <p className="text-sm text-foreground whitespace-pre-wrap">{entry.details}</p>
                                                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                                                        <div className="flex items-center gap-2">
                                                            <User className="h-3 w-3" />
                                                            <span>{entry.operator}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Clock className="h-3 w-3" />
                                                            <span>{timestamp ? format(timestamp, 'dd/MM/yy, p') : 'Just now'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center text-muted-foreground h-full flex items-center justify-center">
                                    No notes for this task.
                                </div>
                            )}
                        </ScrollArea>
                        <div className="space-y-2 shrink-0 pt-4">
                            <Label htmlFor="new-note">Add a new note</Label>
                            <Textarea 
                                id="new-note"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Type your note here..."
                                disabled={isPending}
                                className="min-h-[60px]"
                            />
                            <Button onClick={handleAddNote} disabled={isPending || !note.trim()} size="sm">
                                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Add Note
                            </Button>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
