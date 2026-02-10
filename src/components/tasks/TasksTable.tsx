'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { MoreHorizontal, Edit, Trash2, CheckCircle, Circle, Loader2, History } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Task, TaskStatus } from '@/lib/types';
import { taskStatus } from '@/lib/types';
import { useSession } from '@/components/auth/session-provider';
import { updateTaskStatus } from '@/lib/server-actions-tasks';
import { useToast } from '@/hooks/use-toast';
import { SimplePagination } from '../ui/pagination';

const ROWS_PER_PAGE = 7;

type TasksTableProps = {
    tasks: Task[];
    onEdit: (task: Task) => void;
    onDelete: (task: Task) => void;
    onStatusChange: () => void;
    onViewHistory: (task: Task) => void;
};

export function TasksTable({ tasks, onEdit, onDelete, onStatusChange, onViewHistory }: TasksTableProps) {
    const { operator } = useSession();
    const { toast } = useToast();
    const [isUpdating, startUpdateTransition] = useTransition();
    const [currentPage, setCurrentPage] = useState(1);

    const totalPages = Math.ceil(tasks.length / ROWS_PER_PAGE);

    const paginatedTasks = useMemo(() => {
        const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
        return tasks.slice(startIndex, startIndex + ROWS_PER_PAGE);
    }, [tasks, currentPage]);
    
    useEffect(() => {
        // Reset to first page when the tasks data changes (e.g., due to filtering)
        setCurrentPage(1);
    }, [tasks]);

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const handleStatusChange = (task: Task, newStatus: TaskStatus) => {
        if (!operator) return;
        startUpdateTransition(async () => {
            const result = await updateTaskStatus(task.id!, newStatus, operator);
            if (result.success) {
                toast({ title: "Success", description: `Task ${task.taskId} moved to ${newStatus}.` });
                onStatusChange();
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.message });
            }
        });
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
    
    if (tasks.length === 0) {
        return <div className="text-center text-muted-foreground p-10">No tasks match your criteria.</div>;
    }

    return (
        <>
            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Details</TableHead>
                            <TableHead>Assigned To</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead><span className="sr-only">Actions</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedTasks.map(task => (
                            <TableRow key={task.id}>
                                <TableCell><Badge variant="secondary">{task.taskId}</Badge></TableCell>
                                <TableCell>{format(new Date(task.createdAt), 'dd/MM/yy')}</TableCell>
                                <TableCell>{task.type}</TableCell>
                                <TableCell className="max-w-xs truncate">{task.details}</TableCell>
                                <TableCell><Badge variant="outline">{task.assignedTo}</Badge></TableCell>
                                <TableCell>{task.completionDate ? format(new Date(task.completionDate), 'dd/MM/yy') : 'N/A'}</TableCell>
                                <TableCell>
                                    <Badge className={cn('text-white border-transparent', getStatusClass(task.status))}>
                                        {task.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" disabled={isUpdating}>
                                                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuSub>
                                                <DropdownMenuSubTrigger>Move to</DropdownMenuSubTrigger>
                                                <DropdownMenuSubContent>
                                                    <DropdownMenuRadioGroup value={task.status} onValueChange={(value) => handleStatusChange(task, value as TaskStatus)}>
                                                        {taskStatus.map(s => (
                                                            <DropdownMenuRadioItem key={s} value={s}>
                                                                {s}
                                                            </DropdownMenuRadioItem>
                                                        ))}
                                                    </DropdownMenuRadioGroup>
                                                </DropdownMenuSubContent>
                                            </DropdownMenuSub>
                                            <DropdownMenuItem onSelect={() => onEdit(task)}><Edit className="mr-2 h-4 w-4" />Edit / Add Note</DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => onViewHistory(task)}><History className="mr-2 h-4 w-4" />View History</DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onSelect={() => onDelete(task)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <SimplePagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={handlePageChange}
                className="pt-4"
            />
        </>
    );
}
