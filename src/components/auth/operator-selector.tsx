
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type Operator } from '@/lib/types';
import { User, Sparkles, Shield, ArrowRight, Quote } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSession } from './session-provider';
import { Logo } from '@/components/logo';

type OperatorSelectorProps = {
    onSelect: (operator: Operator) => void;
};

const MOTIVATIONAL_QUOTES = [
    "Great work creates lasting impressions. Ready to craft amazing prints today?",
    "Excellence is not an act, but a habit. Let's make today productive and successful!",
    "Quality is remembered long after price is forgotten. Let's deliver top perfection!",
    "Every order is an opportunity to amaze our customers. Have an incredible shift!"
];

export function OperatorSelector({ onSelect }: OperatorSelectorProps) {
    const { operators, isLoadingOperators } = useSession();
    const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null);
    const { toast } = useToast();

    // Pick a deterministic or random quote for the session
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
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100 relative overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute top-1/4 left-1/4 -mt-20 -ml-20 w-96 h-96 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 -mb-20 -mr-20 w-96 h-96 rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />

            <div className="w-full max-w-md animate-in fade-in-50 slide-in-from-bottom-6 duration-700 space-y-6">
                {/* Brand Logo & Header */}
                <div className="flex flex-col items-center text-center space-y-3">
                    <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl">
                        <Logo />
                    </div>
                </div>

                {/* Main Operator Selection Card */}
                <Card className="rounded-3xl border border-white/15 bg-slate-900/80 backdrop-blur-xl shadow-2xl overflow-hidden text-slate-100">
                    <CardHeader className="text-center pb-2 pt-8">
                        <div className="mx-auto bg-gradient-to-r from-amber-400 to-rose-400 p-0.5 rounded-full w-fit mb-3 shadow-lg">
                            <div className="bg-slate-950 p-3 rounded-full">
                                <Sparkles className="h-7 w-7 text-amber-300" />
                            </div>
                        </div>

                        {/* Animated Welcome Title */}
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-extrabold uppercase tracking-wider mb-2">
                            <span>Welcome Back</span>
                        </div>

                        <CardTitle className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                            Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-rose-300 to-purple-300">Print Today</span>
                        </CardTitle>

                        <CardDescription className="text-slate-300 text-sm mt-1">
                            Please select your operator name to initialize your POS workspace session.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6 px-6 sm:px-8 pt-4">
                        {/* Motivational Quote Banner */}
                        <div className="p-4 rounded-2xl bg-indigo-950/60 border border-indigo-500/30 backdrop-blur-md relative overflow-hidden group hover:border-indigo-500/50 transition-all duration-300">
                            <div className="flex items-start gap-3">
                                <Quote className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                                <p className="text-xs sm:text-sm font-medium italic text-indigo-200 leading-relaxed">
                                    "{quote}"
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                                Operator Profile
                            </label>
                            <Select onValueChange={(value: Operator) => setSelectedOperator(value)}>
                                <SelectTrigger className="w-full h-12 rounded-2xl bg-white/10 border-white/20 text-white font-bold text-base focus:ring-2 focus:ring-amber-400">
                                    <SelectValue placeholder={isLoadingOperators ? "Loading operators..." : "Select your name..."} />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-700 text-white rounded-2xl">
                                    {operators.map(op => (
                                        <SelectItem key={op.id} value={op.id} className="font-semibold py-2.5 focus:bg-indigo-600 focus:text-white">
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-indigo-400" />
                                                <span>{op.id}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>

                    <CardFooter className="px-6 sm:px-8 pb-8 pt-2">
                        <Button 
                            onClick={handleContinue} 
                            disabled={isLoadingOperators || !selectedOperator}
                            className="w-full h-12 rounded-2xl font-black text-base bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 hover:opacity-90 text-white shadow-xl hover:shadow-amber-500/25 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                        >
                            <span>Continue to PIN Verification</span>
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </CardFooter>
                </Card>

                <p className="text-center text-xs text-slate-400 font-medium">
                    Print Today EPOS System • Secure Staff Access
                </p>
            </div>
        </div>
    );
}
