
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type Operator } from '@/lib/types';
import { User, Printer, Layers, ArrowRight, Quote, Shirt, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSession } from './session-provider';
import { Logo } from '@/components/logo';

type OperatorSelectorProps = {
    onSelect: (operator: Operator) => void;
};

const MOTIVATIONAL_QUOTES = [
    "Flyers, Business Cards, Custom T-Shirts & Banners — Crafting vibrant print perfection on every order!",
    "From high-volume flyers to custom workwear & merchandise — delivering excellence with speed!",
    "Quality print production that makes our clients stand out. Have a fantastic & productive shift!"
];

export function OperatorSelector({ onSelect }: OperatorSelectorProps) {
    const { operators, isLoadingOperators } = useSession();
    const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null);
    const { toast } = useToast();

    // Pick a motivational quote tailored for Print Today
    const quote = MOTIVATIONAL_QUOTES[0];

    const handleContinue = () => {
        if (selectedOperator) {
            onSelect(selectedOperator);
            toast({
                title: 'Welcome back!',
                description: `Operator ${selectedOperator} selected. Please enter your PIN.`,
            });
        } else {
            toast({
                variant: 'destructive',
                title: 'Selection Required',
                description: 'Please select your operator profile to continue.',
            });
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-indigo-50/70 to-purple-50/60 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 text-slate-900 dark:text-slate-100 relative overflow-hidden">
            {/* Ambient Background Light Gradient Glows */}
            <div className="absolute top-1/4 left-1/4 -mt-20 -ml-20 w-96 h-96 rounded-full bg-indigo-200/40 dark:bg-indigo-500/20 blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 -mb-20 -mr-20 w-96 h-96 rounded-full bg-purple-200/40 dark:bg-purple-500/20 blur-3xl pointer-events-none" />

            <div className="w-full max-w-md animate-in fade-in-50 slide-in-from-bottom-6 duration-700 relative z-10">
                {/* Main Operator Selection Card */}
                <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100">
                    <CardHeader className="text-center pb-2 pt-8">
                        {/* Printer Emblem Badge */}
                        <div className="mx-auto bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-0.5 rounded-2xl shadow-md w-fit mb-3">
                            <div className="bg-white dark:bg-slate-950 p-2.5 rounded-[14px] flex items-center gap-2">
                                <Printer className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                                <Layers className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            </div>
                        </div>

                        <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                            Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-400 dark:to-purple-400 font-extrabold">Print Today</span>
                        </CardTitle>

                        <CardDescription className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1.5 font-normal">
                            Select your operator name to launch your print workspace.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-5 px-6 sm:px-8 pt-4">
                        {/* Motivational Quote Banner tailored for Print Today */}
                        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-50/80 via-purple-50/70 to-pink-50/80 dark:from-indigo-950/50 dark:to-purple-950/50 border border-indigo-100 dark:border-indigo-800/50 relative overflow-hidden shadow-sm">
                            <div className="flex items-start gap-2.5">
                                <Quote className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                                <p className="text-xs font-medium italic text-slate-700 dark:text-indigo-200 leading-relaxed">
                                    "{quote}"
                                </p>
                            </div>
                            
                            {/* Service Badges */}
                            <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-indigo-100 dark:border-indigo-800/40 text-[11px] font-semibold text-slate-700 dark:text-indigo-300">
                                <span className="px-2 py-0.5 rounded-md bg-white dark:bg-indigo-900/50 border border-indigo-100 dark:border-indigo-800/50 flex items-center gap-1">
                                  <FileText className="h-3 w-3 text-indigo-600" /> Flyers
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-white dark:bg-purple-900/50 border border-purple-100 dark:border-purple-800/50 flex items-center gap-1">
                                  <Layers className="h-3 w-3 text-purple-600" /> Cards
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-white dark:bg-pink-900/50 border border-pink-100 dark:border-pink-800/50 flex items-center gap-1">
                                  <Shirt className="h-3 w-3 text-pink-600" /> T-Shirts
                                </span>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                Select Operator Name
                            </label>
                            <Select onValueChange={(value: Operator) => setSelectedOperator(value)}>
                                <SelectTrigger className="w-full h-11 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium text-sm focus:ring-2 focus:ring-indigo-600 shadow-sm">
                                    <SelectValue placeholder={isLoadingOperators ? "Loading operators..." : "Choose your name..."} />
                                </SelectTrigger>
                                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl shadow-xl">
                                    {operators.map(op => (
                                        <SelectItem key={op.id} value={op.id} className="font-medium text-sm py-2 focus:bg-indigo-600 focus:text-white">
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                                <span>{op.id}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>

                    <CardFooter className="px-6 sm:px-8 pb-7 pt-2">
                        <Button 
                            onClick={handleContinue} 
                            disabled={isLoadingOperators || !selectedOperator}
                            className="w-full h-11 rounded-xl font-semibold text-sm bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:opacity-95 text-white shadow-lg hover:shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
                        >
                            <span>Continue to PIN Verification</span>
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </CardFooter>
                </Card>

                <p className="text-center text-xs text-slate-500 dark:text-slate-400 font-normal mt-4">
                    Print Today EPOS System • Secure Staff Access
                </p>
            </div>
        </div>
    );
}
