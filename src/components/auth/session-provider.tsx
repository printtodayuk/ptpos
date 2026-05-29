'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Operator } from '@/lib/types';
import { getOperators } from '@/lib/server-actions-operators';

interface SessionContextType {
    isAuthenticated: boolean;
    operator: Operator | null;
    login: (operator: Operator) => void;
    logout: () => void;
    operators: { id: string; pin: string }[];
    isLoadingOperators: boolean;
    refreshOperators: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | null>(null);

const SESSION_STORAGE_KEY = 'app-session';

export function SessionProvider({ children }: { children: React.ReactNode }) {
    const [operator, setOperator] = useState<Operator | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [operators, setOperators] = useState<{ id: string; pin: string }[]>([]);
    const [isLoadingOperators, setIsLoadingOperators] = useState(true);

    const refreshOperators = useCallback(async () => {
        setIsLoadingOperators(true);
        try {
            const list = await getOperators();
            setOperators(list);
        } catch (error) {
            console.error("Failed to load operators", error);
        } finally {
            setIsLoadingOperators(false);
        }
    }, []);

    useEffect(() => {
        refreshOperators();
    }, [refreshOperators]);

    useEffect(() => {
        try {
            const storedSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
            if (storedSession) {
                const sessionData = JSON.parse(storedSession);
                if (sessionData.operator) {
                    setOperator(sessionData.operator);
                    setIsAuthenticated(true);
                }
            }
        } catch (error) {
            console.error("Failed to parse session from storage", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const login = useCallback((selectedOperator: Operator) => {
        const sessionData = { operator: selectedOperator };
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
        setOperator(selectedOperator);
        setIsAuthenticated(true);
    }, []);

    const logout = useCallback(() => {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        setOperator(null);
        setIsAuthenticated(false);
    }, []);

    if (isLoading) {
        return null;
    }

    return (
        <SessionContext.Provider value={{ 
            isAuthenticated, 
            operator, 
            login, 
            logout,
            operators,
            isLoadingOperators,
            refreshOperators
        }}>
            {children}
        </SessionContext.Provider>
    );
}

export const useSession = () => {
    const context = useContext(SessionContext);
    if (!context) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
};
