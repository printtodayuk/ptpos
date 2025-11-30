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

const CORRECT_PIN = '1593';

export function PinLock({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, operator, login } = useSession();
    const [pin, setPin] = useState('');
    const { toast } = useToast();
    const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null);

    const handleOperatorSelect = (op: Operator) => {
        setSelectedOperator(op);
    };

    const handlePinSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (pin === CORRECT_PIN && selectedOperator) {
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
        <div className="flex items-center justify-center h-screen bg-secondary/20">
            <Card className="w-full max-w-sm">
                <form onSubmit={handlePinSubmit}>
                    <CardHeader className="text-center">
                        <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
                            <ShieldCheck className="h-8 w-8 text-primary" />
                        </div>
                        <CardTitle>Enter PIN for {selectedOperator}</CardTitle>
                        <CardDescription>Please enter your PIN to unlock the app.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Input
                            type="password"
                            placeholder="****"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            className="text-center text-2xl tracking-[1em]"
                            maxLength={4}
                            autoFocus
                        />
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        <Button type="submit" className="w-full">
                            Unlock
                        </Button>
                        <Button variant="link" onClick={() => setSelectedOperator(null)}>
                            Change Operator
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
