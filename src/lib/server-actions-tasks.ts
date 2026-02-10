
'use server';

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { format } from 'date-fns';

import { db } from '@/lib/firebase';
import {
  TaskSchema,
  TaskTypeSchema,
  type Operator,
  type Task,
  type TaskHistory,
  type TaskStatus,
  type TaskType,
} from '@/lib/types';


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

const CreateTaskSchema = TaskSchema.omit({ id: true, taskId: true, createdAt: true, history: true });
const CreateTaskTypeSchema = TaskTypeSchema.omit({ id: true });


async function getNextTaskId(): Promise<string> {
    const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        return "TSK001";
    }
    const lastTask = snapshot.docs[0].data();
    const lastId = lastTask.taskId || "TSK000";
    const lastNum = parseInt(lastId.replace(/[^0-9]/g, ''), 10) || 0;
    const newNum = lastNum + 1;
    return `TSK${String(newNum).padStart(3, '0')}`;
}


export async function getTaskTypes(): Promise<TaskType[]> {
    const q = query(collection(db, 'taskTypes'), orderBy('name'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as TaskType));
}


export async function addTaskType(name: string) {
    const validated = CreateTaskTypeSchema.safeParse({ name });
    if (!validated.success) {
        return { success: false, message: 'Validation failed' };
    }
    const q = query(collection(db, 'taskTypes'), where('name', '==', name));
    const existingSnapshot = await getDocs(q);
    if (!existingSnapshot.empty) {
        return { success: false, message: 'This type already exists.' };
    }
    const docRef = await addDoc(collection(db, 'taskTypes'), validated.data);
    revalidatePath('/dashboard');
    return { success: true, message: 'Task type added.', id: docRef.id };
}


export async function addTask(data: z.infer<typeof CreateTaskSchema>) {
    const validatedData = CreateTaskSchema.safeParse(data);
    if (!validatedData.success) {
        return { success: false, message: 'Validation failed', errors: validatedData.error.flatten().fieldErrors };
    }
    try {
        const taskId = await getNextTaskId();
        const historyEntry: TaskHistory = {
            timestamp: serverTimestamp(),
            operator: validatedData.data.createdBy,
            action: 'Created',
            details: `Task created and assigned to ${validatedData.data.assignedTo}.`,
        };

        await addDoc(collection(db, 'tasks'), {
            ...validatedData.data,
            taskId,
            createdAt: serverTimestamp(),
            completionDate: data.completionDate ? Timestamp.fromDate(data.completionDate) : null,
            history: [historyEntry],
        });
        revalidatePath('/dashboard');
        return { success: true, message: 'Task created successfully.' };
    } catch (error) {
        console.error("Error adding task:", error);
        const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
        return { success: false, message: errorMessage };
    }
}


export async function getTasks(filters?: { searchTerm?: string; assignedTo?: Operator }): Promise<Task[]> {
    let tasksQuery: any = collection(db, 'tasks'); // Use 'any' to allow dynamic query building
    const constraints: any[] = [orderBy('createdAt', 'desc')];
    
    if (filters?.assignedTo) {
        constraints.push(where('assignedTo', '==', filters.assignedTo));
    }
    
    // Only limit if there are no filters, to keep initial load fast
    if (!filters?.searchTerm && !filters?.assignedTo) {
        constraints.push(limit(50));
    }

    const q = query(tasksQuery, ...constraints);
    const snapshot = await getDocs(q);
    
    let tasks = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            ...data,
            id: doc.id,
            createdAt: toDate(data.createdAt),
            completionDate: toDate(data.completionDate)
        } as Task;
    });

    if (filters?.searchTerm) {
        const lowercasedTerm = filters.searchTerm.toLowerCase();
        tasks = tasks.filter(task => 
            task.taskId.toLowerCase().includes(lowercasedTerm) ||
            task.details.toLowerCase().includes(lowercasedTerm) ||
            task.type.toLowerCase().includes(lowercasedTerm)
        );
    }
    
    return tasks;
}


export async function updateTask(
    id: string,
    data: Partial<z.infer<typeof CreateTaskSchema>>,
    operator: Operator,
    note?: string
) {
    const taskRef = doc(db, 'tasks', id);
    const taskSnap = await getDoc(taskRef);
    if (!taskSnap.exists()) return { success: false, message: 'Task not found.' };

    const originalData = taskSnap.data();
    const validatedData = CreateTaskSchema.partial().safeParse(data);
    if (!validatedData.success) {
        return { success: false, message: 'Validation failed.' };
    }

    const changes: string[] = [];
    const newHistory = [...(originalData.history || [])];

    // Compare fields and generate history for explicit changes
    if (validatedData.data.type && originalData.type !== validatedData.data.type) {
        changes.push(`Type changed from "${originalData.type}" to "${validatedData.data.type}".`);
    }
    if (validatedData.data.details && originalData.details !== validatedData.data.details) {
        changes.push('Details were updated.');
    }
    if (validatedData.data.assignedTo && originalData.assignedTo !== validatedData.data.assignedTo) {
        changes.push(`Assignee changed from ${originalData.assignedTo} to ${validatedData.data.assignedTo}.`);
    }

    const originalDueDateAsDate = toDate(originalData.completionDate);
    const originalDueDate = originalDueDateAsDate ? format(originalDueDateAsDate, 'PPP') : 'none';
    const newDueDateAsDate = validatedData.data.completionDate;
    const newDueDate = newDueDateAsDate ? format(newDueDateAsDate, 'PPP') : 'none';

    if (validatedData.data.completionDate !== undefined && originalDueDate !== newDueDate) {
        changes.push(`Due date changed from ${originalDueDate} to ${newDueDate}.`);
    }

    if (changes.length > 0) {
        const historyEntry: TaskHistory = {
            timestamp: serverTimestamp(),
            operator,
            action: 'Updated',
            details: changes.join(' '),
        };
        newHistory.push(historyEntry);
    }

    // If a new note was added, log it separately
    if (note && note.trim() !== '') {
        const noteEntry: TaskHistory = {
            timestamp: serverTimestamp(),
            operator,
            action: 'Note Added',
            details: note.trim(),
        };
        newHistory.push(noteEntry);
    }

    const updatePayload: any = {
        ...data,
        history: newHistory,
    };

    if (data.completionDate) {
        updatePayload.completionDate = Timestamp.fromDate(data.completionDate);
    } else if (data.completionDate === null) {
        updatePayload.completionDate = null;
    }

    await updateDoc(taskRef, updatePayload);
    revalidatePath('/dashboard');
    return { success: true, message: 'Task updated.' };
}


export async function updateTaskStatus(id: string, status: TaskStatus, operator: Operator) {
    const taskRef = doc(db, 'tasks', id);
    const taskSnap = await getDoc(taskRef);
    if (!taskSnap.exists()) return { success: false, message: 'Task not found.' };

    const originalData = taskSnap.data();
    const historyEntry: TaskHistory = {
        timestamp: serverTimestamp(),
        operator,
        action: 'Status Change',
        details: `Status changed from ${originalData.status} to ${status}.`,
    };
    await updateDoc(taskRef, {
        status,
        history: [...(originalData.history || []), historyEntry],
    });
    revalidatePath('/dashboard');
    return { success: true, message: 'Task status updated.' };
}


export async function deleteTask(id: string) {
    await deleteDoc(doc(db, 'tasks', id));
    revalidatePath('/dashboard');
    return { success: true, message: 'Task deleted.' };
}
