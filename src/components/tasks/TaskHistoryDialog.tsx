'use client';

import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { type Task, type TaskHistory } from '@/lib/types';
import { Clock, User, MessageSquare } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

type TaskHistoryDialogProps = {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
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


export function TaskHistoryDialog({ task, isOpen, onClose }: TaskHistoryDialogProps) {
  if (!task) return null;

  // Sort history from newest to oldest
  const sortedHistory = [...(task.history || [])].sort((a, b) => {
    const dateA = toDate(a.timestamp);
    const dateB = toDate(b.timestamp);
    if (!dateA || !dateB) return 0;
    return dateB.getTime() - dateA.getTime();
  });


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>History for Task {task.taskId}</DialogTitle>
          <DialogDescription>
            A complete log of all changes and notes for this task.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] h-full pr-6">
            <div className="relative pl-6">
                {/* Timeline line */}
                <div className="absolute left-[30px] top-0 h-full w-0.5 bg-border -translate-x-1/2"></div>
                
                {sortedHistory.map((entry, index) => {
                     const timestamp = toDate(entry.timestamp);
                     const isNote = entry.action === 'Note Added';
                     return (
                        <div key={index} className="relative pl-8 mb-8">
                            {/* Timeline dot */}
                            <div className={`absolute left-[30px] top-1 h-3 w-3 rounded-full ${isNote ? 'bg-amber-500' : 'bg-primary'} -translate-x-1/2`}></div>
                            
                            <div className={`p-4 rounded-lg border ${isNote ? 'bg-amber-50 border-amber-200' : 'bg-card'}`}>
                                {isNote ? (
                                    <p className="text-sm text-foreground whitespace-pre-wrap">{entry.details}</p>
                                ) : (
                                    <p className="font-semibold text-sm text-foreground">{entry.action}: <span className="font-normal text-muted-foreground whitespace-pre-wrap">{entry.details}</span></p>
                                )}
                                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <User className="h-3 w-3" />
                                        <span>{entry.operator}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-3 w-3" />
                                        <span>{timestamp ? format(timestamp, 'dd/MM/yyyy, p') : 'Just now'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                     )
                })}
                 {sortedHistory.length === 0 && (
                    <div className="text-center text-muted-foreground p-10">
                        No history recorded for this task.
                    </div>
                )}
            </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
