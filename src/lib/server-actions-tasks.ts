'use server';

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { TaskSchema, TaskTypeSchema, type Operator, type Task, type TaskHistory, type TaskStatus, type TaskType } from '@/lib/types';
import { format } from 'date-fns';

const CreateTaskSchema = TaskSchema.omit({ id: true, taskId: true, createdAt: true, history: true });
const CreateTaskTypeSchema = TaskTypeSchema.omit({ id: true });

async function getNextTaskId(): Promise<string> {
    const counterRef = doc(db, 'counters', 'tasks');
    try {
        const newCount = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            if (!counterDoc.exists()) {
                transaction.set(counterRef, { count: 1 });
                return 1;
            }
            const newCount = counterDoc.data().count + 1;
            transaction.update(counterRef, { count: newCount });
            return newCount;
        });
        return String(newCount).padStart(3, '0');
    } catch (error) {
        console.error("Error getting next task ID:", error);
        throw new Error("Could not generate a new task ID.");
    }
}

export async function getTaskTypes(): Promise<TaskType[]> {
    const snapshot = await getDocs(query(collection(db, 'taskTypes'), orderBy('name')));
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as TaskType));
}

export async function addTaskType(name: string) {
    const validated = CreateTaskTypeSchema.safeParse({ name });
    if (!validated.success) {
        return { success: false, message: 'Validation failed' };
    }
    const existingQuery = query(collection(db, 'taskTypes'), where('name', '==', name));
    const existingSnapshot = await getDocs(existingQuery);
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
    const taskId = await getNextTaskId();
    const historyEntry: TaskHistory = {
        timestamp: Timestamp.now(),
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
}

export async function getTasks(): Promise<Task[]> {
    const snapshot = await getDocs(query(collection(db, 'tasks'), orderBy('createdAt', 'desc')));
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            ...data,
            id: doc.id,
            createdAt: (data.createdAt as Timestamp)?.toDate(),
            completionDate: (data.completionDate as Timestamp)?.toDate()
        } as Task;
    });
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
    
    const originalDueDate = originalData.completionDate ? format((originalData.completionDate as Timestamp).toDate(), 'PPP') : 'none';
    const newDueDate = validatedData.data.completionDate ? format(new Date(validatedData.data.completionDate), 'PPP') : 'none';
    if (validatedData.data.completionDate !== undefined && originalDueDate !== newDueDate) {
        changes.push(`Due date changed from ${originalDueDate} to ${newDueDate}.`);
    }
    
    if (changes.length > 0) {
        const historyEntry: TaskHistory = {
            timestamp: Timestamp.now(),
            operator,
            action: 'Updated',
            details: changes.join(' '),
        };
        newHistory.push(historyEntry);
    }
    
    // If a new note was added, log it separately
    if (note && note.trim() !== '') {
        const noteEntry: TaskHistory = {
            timestamp: Timestamp.now(),
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
        timestamp: Timestamp.now(),
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
