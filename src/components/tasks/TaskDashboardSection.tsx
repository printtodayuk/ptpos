'use client';

import { useState, useEffect, useTransition, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, ListTodo, Search, Filter, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { getTasks, deleteTask } from '@/lib/server-actions-tasks';
import type { Task, Operator } from '@/lib/types';
import { useSession } from '@/components/auth/session-provider';
import { useDebounce } from '@/hooks/use-debounce';
import { TaskFormDialog } from './TaskFormDialog';
import { TasksTable } from './TasksTable';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { TaskViewDialog } from './TaskViewDialog';

export function TaskDashboardSection() {
    const { operators: dynamicOperators } = useSession();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, startLoading] = useTransition();
    
    // Collapsible state: default off (false) as requested by user
    const [isExpanded, setIsExpanded] = useState(false);

    const filterableOperators = useMemo(() => ['All', ...dynamicOperators.map(op => op.id)], [dynamicOperators]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
    const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
    const [taskToView, setTaskToView] = useState<Task | null>(null);
    const { toast } = useToast();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [assignedToFilter, setAssignedToFilter] = useState<'All' | Operator>('All');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    const fetchTasks = useCallback(() => {
        startLoading(async () => {
            const fetchedTasks = await getTasks({
                searchTerm: debouncedSearchTerm,
                assignedTo: assignedToFilter === 'All' ? undefined : assignedToFilter,
            });
            setTasks(fetchedTasks);
        });
    }, [debouncedSearchTerm, assignedToFilter]);


    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);
    
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

            <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-md overflow-hidden transition-all duration-300">
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800/60 p-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                            <ListTodo className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">Tasks & Requests</CardTitle>
                              <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
                                {tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'}
                              </span>
                            </div>
                            <CardDescription className="text-xs mt-0.5">Internal task list and operation request tracking.</CardDescription>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto">
                        <Button 
                            variant="outline" 
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="rounded-2xl border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 font-extrabold flex-1 sm:flex-none h-10 transition-all duration-200"
                        >
                            {isExpanded ? (
                                <>
                                    <ChevronUp className="mr-1.5 h-4 w-4 text-indigo-500" />
                                    <span>Hide Tasks</span>
                                </>
                            ) : (
                                <>
                                    <Eye className="mr-1.5 h-4 w-4 text-indigo-500" />
                                    <span>View Tasks</span>
                                    <ChevronDown className="ml-1 h-4 w-4 text-indigo-500 animate-bounce" />
                                </>
                            )}
                        </Button>

                        <Button onClick={() => setIsDialogOpen(true)} className="rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold shadow-md h-10 flex-1 sm:flex-none">
                            <Plus className="mr-1.5 h-4 w-4" /> Create Task
                        </Button>
                    </div>
                </CardHeader>

                {/* Collapsible Content with smooth slide-down animation */}
                {isExpanded && (
                    <CardContent className="p-6 space-y-4 animate-in fade-in-50 slide-in-from-top-3 duration-300">
                         <div className="flex flex-col sm:flex-row items-center gap-3">
                            <div className="relative w-full">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    type="text"
                                    placeholder="Search by Task ID, details, or type..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 rounded-2xl h-11"
                                />
                            </div>
                            <Select value={assignedToFilter} onValueChange={(value) => setAssignedToFilter(value as 'All' | Operator)}>
                                <SelectTrigger className="w-full sm:w-[220px] flex-shrink-0 rounded-2xl h-11 font-semibold">
                                    <Filter className="mr-2 h-4 w-4 text-slate-400" />
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
                            <div className="flex flex-col items-center justify-center p-12 space-y-2">
                              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                              <p className="text-xs text-muted-foreground font-semibold">Fetching tasks...</p>
                            </div>
                        ) : (
                            <TasksTable
                              tasks={tasks}
                              onEdit={handleEdit}
                              onDelete={handleDeleteRequest}
                              onStatusChange={fetchTasks}
                              onViewTask={handleViewTask}
                            />
                        )}
                    </CardContent>
                )}

                {!isExpanded && (
                    <div 
                      onClick={() => setIsExpanded(true)}
                      className="p-4 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between text-xs text-slate-500 font-semibold cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <ListTodo className="h-3.5 w-3.5 text-indigo-500" />
                        Click view tasks button or click here to expand {tasks.length} task entries.
                      </span>
                      <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-extrabold">
                        View Tasks Table <ChevronDown className="h-4 w-4" />
                      </span>
                    </div>
                )}
            </Card>
        </>
    );
}
