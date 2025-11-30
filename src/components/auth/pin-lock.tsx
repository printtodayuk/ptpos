'use client';

import { OperatorSelector } from './operator-selector';
import { useSession } from './session-provider';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const CORRECT_PIN = '1593';

export function PinLock({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, operator, login } = useSession();
    const [pin, setPin] = useState('');
    const { toast } = useToast();
    const [showPin, setShowPin] = useState(true);
    const [showOperatorSelector, setShowOperatorSelector] = useState(false);

    const handlePinSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (pin === CORRECT_PIN) {
            setShowPin(false);
            setShowOperatorSelector(true);
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

    if (showOperatorSelector) {
        return <OperatorSelector onSelect={login} />;
    }

    if (showPin) {
        return (
            <div className="flex items-center justify-center h-screen bg-secondary/20">
                <Card className="w-full max-w-sm">
                    <form onSubmit={handlePinSubmit}>
                        <CardHeader className="text-center">
                            <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
                                <ShieldCheck className="h-8 w-8 text-primary" />
                            </div>
                            <CardTitle>Application Locked</CardTitle>
                            <CardDescription>Please enter your PIN to continue.</CardDescription>
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
                        <CardFooter>
                            <Button type="submit" className="w-full">
                                Unlock
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        );
    }
    
    return null;
}
