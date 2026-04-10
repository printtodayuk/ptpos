import { ContactForm } from '@/components/contacts/contact-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/logo';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-secondary/20 flex flex-col items-center justify-center p-4">
        <div className="mb-8">
            <Logo />
        </div>
        <Card className="w-full max-w-2xl">
            <CardHeader>
                <CardTitle>Contact Information</CardTitle>
                <CardDescription>Please fill out your details below. We'll get back to you shortly.</CardDescription>
            </CardHeader>
            <CardContent>
                <ContactForm />
            </CardContent>
        </Card>
        <div className="mt-8 text-center">
            <Button variant="ghost" asChild>
                <a href="https://www.printtodayuk.com">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Website
                </a>
            </Button>
        </div>
        <footer className="text-center p-4 mt-8 text-xs text-muted-foreground">
             Developed by{' '}
            <a
              href="mailto:info@remotizedit.com"
              className="font-medium text-primary hover:underline"
            >
              Fazle Rifat Anonto, RemotizedIT
            </a>
            .
          </footer>
    </div>
  );
}
