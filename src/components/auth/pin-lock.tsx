
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

            <Card className="w-full max-w-md animate-in fade-in-50 slide-in-from-bottom-6 duration-700 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 relative z-10">
                <form onSubmit={handlePinSubmit}>
                    <CardHeader className="text-center pt-8 pb-3">
                        <div className="mx-auto bg-indigo-50 dark:bg-indigo-900/40 p-3 rounded-2xl w-fit mb-3 border border-indigo-100 dark:border-indigo-800">
                            <ShieldCheck className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                            Enter PIN for <span className="text-indigo-600 dark:text-amber-300 font-extrabold">{selectedOperator}</span>
                        </CardTitle>
                        <CardDescription className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 font-normal">
                            Please enter your 4-digit passcode to unlock POS workspace.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="px-6 sm:px-8 py-3 space-y-4">
                        {/* Visual PIN Dots Indicator */}
                        <div className="flex justify-center items-center gap-2.5 py-1">
                            {[0, 1, 2, 3].map((index) => {
                                const isFilled = pin.length > index;
                                return (
                                    <div
                                        key={index}
                                        className={cn(
                                            "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base transition-all duration-200 border",
                                            isFilled
                                                ? "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white border-indigo-400 shadow-md scale-105"
                                                : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/20 text-slate-400"
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
                            className="text-center text-2xl font-bold tracking-[0.7em] h-12 rounded-xl border-slate-200 dark:border-slate-700 text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600 font-mono shadow-inner"
                            maxLength={4}
                            autoFocus
                        />
                    </CardContent>
                    <CardFooter className="flex flex-col gap-2.5 px-6 sm:px-8 pb-7 pt-2">
                        <Button type="submit" className="w-full h-11 rounded-xl font-semibold text-sm bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:opacity-95 text-white shadow-lg hover:shadow-indigo-500/20 transition-all">
                            Unlock Workspace
                        </Button>
                        <Button variant="ghost" type="button" onClick={() => setSelectedOperator(null)} className="w-full rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-medium">
                            ← Select Different Operator
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
