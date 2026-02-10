
'use client';

import { useState, useEffect, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, ListTodo } from 'lucide-react';
import { getTasks, deleteTask } from '@/lib/server-actions-tasks';
import type { Task } from '@/lib/types';
import { TaskFormDialog } from './TaskFormDialog';
import { TasksTable } from './TasksTable';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

export function TaskDashboardSection() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
    const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
    const { toast } = useToast();

    const fetchTasks = () => {
        startLoading(async () => {
            const fetchedTasks = await getTasks();
            setTasks(fetchedTasks);
        });
    };

    useEffect(() => {
        fetchTasks();
    }, []);

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

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-xl flex items-center gap-2"><ListTodo /> Tasks & Requests</CardTitle>
                        <CardDescription>An overview of all internal tasks and requests.</CardDescription>
                    </div>
                    <Button onClick={() => setIsDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> Create Task/Request
                    </Button>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : (
                        <TasksTable tasks={tasks} onEdit={handleEdit} onDelete={handleDeleteRequest} onStatusChange={fetchTasks} />
                    )}
                </CardContent>
            </Card>
        </>
    );
}
