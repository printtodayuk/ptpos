
'use client';

import { OperatorSelector } from './operator-selector';
import { useSession } from './session-provider';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Operator } from '@/lib/types';
import { cn } from '@/lib/utils';

export function PinLock({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, operator, login, operators, isLoadingOperators } = useSession();
    const [pin, setPin] = useState('');
    const { toast } = useToast();
    const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null);

    const handleOperatorSelect = (op: Operator) => {
        setSelectedOperator(op);
    };

    const handlePinSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const opRecord = operators.find(op => op.id === selectedOperator);
        if (selectedOperator && opRecord && pin === opRecord.pin) {
            login(selectedOperator);
            toast({
                title: 'Access Granted',
                description: `Welcome, ${selectedOperator}!`,
            });
        } else {
            toast({
                variant: 'destructive',
                title: 'Access Denied',
                description: 'The PIN you entered is incorrect.',
            });
            setPin('');
        }
    };

    if (isAuthenticated && operator) {
        return <>{children}</>;
    }

    if (!selectedOperator) {
        return <OperatorSelector onSelect={handleOperatorSelect} />;
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-indigo-50/70 to-purple-50/60 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 text-slate-900 dark:text-slate-100 relative overflow-hidden">
            {/* Ambient Background Light Glows */}
            <div className="absolute top-1/4 left-1/4 -mt-20 -ml-20 w-96 h-96 rounded-full bg-indigo-200/50 dark:bg-indigo-500/20 blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 -mb-20 -mr-20 w-96 h-96 rounded-full bg-purple-200/50 dark:bg-purple-500/20 blur-3xl pointer-events-none" />

            <Card className="w-full max-w-md animate-in fade-in-50 slide-in-from-bottom-6 duration-700 rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 relative z-10">
                <form onSubmit={handlePinSubmit}>
                    <CardHeader className="text-center pt-8 pb-4">
                        <div className="mx-auto bg-indigo-100 dark:bg-indigo-900/40 p-3.5 rounded-full w-fit mb-3 border border-indigo-200 dark:border-indigo-800">
                            <ShieldCheck className="h-8 w-8 text-indigo-600 dark:text-amber-400" />
                        </div>
                        <CardTitle className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                            Enter PIN for <span className="text-indigo-600 dark:text-amber-300">{selectedOperator}</span>
                        </CardTitle>
                        <CardDescription className="text-slate-600 dark:text-slate-300 text-sm mt-1">
                            Please enter your 4-digit passcode to unlock POS workspace.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="px-6 sm:px-8 py-4 space-y-4">
                        {/* Visual PIN Dots Indicator */}
                        <div className="flex justify-center items-center gap-3 py-2">
                            {[0, 1, 2, 3].map((index) => {
                                const isFilled = pin.length > index;
                                return (
                                    <div
                                        key={index}
                                        className={cn(
                                            "w-11 h-11 rounded-2xl flex items-center justify-center font-black text-lg transition-all duration-200 border",
                                            isFilled
                                                ? "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white border-indigo-400 shadow-lg shadow-indigo-500/30 scale-105"
                                                : "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/20 text-slate-400"
                                        )}
                                    >
                                        {isFilled ? "•" : ""}
                                    </div>
                                );
                            })}
                        </div>

                        <Input
                            type="password"
                            placeholder="••••"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            style={{ color: '#090d16', backgroundColor: '#f8fafc' }}
                            className="text-center text-3xl font-black tracking-[0.8em] h-14 rounded-2xl border-slate-300 dark:border-slate-700 text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600 font-mono shadow-inner"
                            maxLength={4}
                            autoFocus
                        />
                    </CardContent>
                    <CardFooter className="flex flex-col gap-3 px-6 sm:px-8 pb-8 pt-2">
                        <Button type="submit" className="w-full h-12 rounded-2xl font-black text-base bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:opacity-95 text-white shadow-xl hover:shadow-indigo-500/25 transition-all transform hover:-translate-y-0.5">
                            Unlock Workspace
                        </Button>
                        <Button variant="ghost" type="button" onClick={() => setSelectedOperator(null)} className="w-full rounded-2xl text-slate-500 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-bold">
                            ← Select Different Operator
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
