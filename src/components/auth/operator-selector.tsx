
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { operators, type Operator } from '@/lib/types';
import { User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type OperatorSelectorProps = {
    onSelect: (operator: Operator) => void;
};

export function OperatorSelector({ onSelect }: OperatorSelectorProps) {
    const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null);
    const { toast } = useToast();

    const handleContinue = () => {
        if (selectedOperator) {
            onSelect(selectedOperator);
            toast({
                title: 'Welcome!',
                description: `You are logged in as ${selectedOperator}.`,
            });
        } else {
            toast({
                variant: 'destructive',
                title: 'Selection Required',
                description: 'Please select an operator to continue.',
            });
        }
    };

    return (
        <div className="flex items-center justify-center h-screen bg-secondary/20">
            <Card className="w-full max-w-sm">
                <CardHeader className="text-center">
                    <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
                        <User className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle>Select Operator</CardTitle>
                    <CardDescription>Choose your name to start your session.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Select onValueChange={(value: Operator) => setSelectedOperator(value)}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select your name..." />
                        </SelectTrigger>
                        <SelectContent>
                            {operators.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleContinue} className="w-full">
                        Continue
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
