'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, ListTodo, Search, Filter } from 'lucide-react';
import { getTasks, deleteTask } from '@/lib/server-actions-tasks';
import type { Task, Operator } from '@/lib/types';
import { operators } from '@/lib/types';
import { useDebounce } from '@/hooks/use-debounce';
import { TaskFormDialog } from './TaskFormDialog';
import { TasksTable } from './TasksTable';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { TaskViewDialog } from './TaskViewDialog';

const filterableOperators: ('All' | Operator)[] = ['All', ...operators];

export function TaskDashboardSection() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
    const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
    const [taskToView, setTaskToView] = useState<Task | null>(null);
    const { toast } = useToast();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [assignedToFilter, setAssignedToFilter] = useState<'All' | Operator>('All');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    const fetchTasks = () => {
        startLoading(async () => {
            const fetchedTasks = await getTasks();
            setTasks(fetchedTasks);
        });
    };

    useEffect(() => {
        fetchTasks();
    }, []);
    
    const filteredTasks = useMemo(() => {
        return tasks.filter(task => {
            const searchMatch = debouncedSearchTerm
                ? task.taskId.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                  task.details.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                  task.type.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
                : true;
            
            const filterMatch = assignedToFilter === 'All'
                ? true
                : task.assignedTo === assignedToFilter;

            return searchMatch && filterMatch;
        });
    }, [tasks, debouncedSearchTerm, assignedToFilter]);


    const handleSuccess = () => {
        setIsDialogOpen(false);
        setTaskToEdit(null);
        fetchTasks();
    };

    const handleEdit = (task: Task) => {
        setTaskToEdit(task);
        setIsDialogOpen(true);
    };

    const handleDeleteRequest = (task: Task) => {
        setTaskToDelete(task);
    };
    
    const handleViewTask = (task: Task) => {
        setTaskToView(task);
    };

    const confirmDelete = async () => {
        if (!taskToDelete) return;
        const result = await deleteTask(taskToDelete.id!);
        if (result.success) {
            toast({ title: 'Success', description: 'Task deleted.' });
            fetchTasks();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.message });
        }
        setTaskToDelete(null);
    };

    return (
        <>
            <TaskFormDialog
                isOpen={isDialogOpen}
                onClose={() => {
                    setIsDialogOpen(false);
                    setTaskToEdit(null);
                }}
                onSuccess={handleSuccess}
                taskToEdit={taskToEdit}
            />
             <AlertDialog open={!!taskToDelete} onOpenChange={() => setTaskToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete task <span className="font-bold">{taskToDelete?.taskId}</span>. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            <TaskViewDialog
                task={taskToView}
                isOpen={!!taskToView}
                onClose={() => setTaskToView(null)}
                onSuccess={fetchTasks}
            />

            <Card>
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-xl flex items-center gap-2"><ListTodo /> Tasks & Requests</CardTitle>
                        <CardDescription>An overview of all internal tasks and requests.</CardDescription>
                    </div>
                    <Button onClick={() => setIsDialogOpen(true)} className="w-full md:w-auto">
                        <Plus className="mr-2 h-4 w-4" /> Create Task/Request
                    </Button>
                </CardHeader>
                <CardContent>
                     <div className="flex flex-col sm:flex-row items-center gap-2 mb-4">
                        <div className="relative w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Search by ID, details, or type..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10"
                            />
                        </div>
                        <Select value={assignedToFilter} onValueChange={(value) => setAssignedToFilter(value as 'All' | Operator)}>
                            <SelectTrigger className="w-full sm:w-[200px] flex-shrink-0">
                                <Filter className="mr-2 h-4 w-4" />
                                <SelectValue placeholder="Filter by assignee" />
                            </SelectTrigger>
                            <SelectContent>
                                {filterableOperators.map((op) => (
                                    <SelectItem key={op} value={op}>{op}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : (
                        <TasksTable
                          tasks={filteredTasks}
                          onEdit={handleEdit}
                          onDelete={handleDeleteRequest}
                          onStatusChange={fetchTasks}
                          onViewTask={handleViewTask}
                        />
                    )}
                </CardContent>
            </Card>
        </>
    );
}
