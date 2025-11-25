import { ContactForm } from '@/components/contacts/contact-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/logo';
import Link from 'next/link';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-secondary/20 flex flex-col items-center justify-center p-4">
        <Link href="/" className="mb-8">
            <Logo />
        </Link>
        <Card className="w-full max-w-2xl">
            <CardHeader>
                <CardTitle>Contact Information</CardTitle>
                <CardDescription>Please fill out your details below. We'll get back to you shortly.</CardDescription>
            </CardHeader>
            <CardContent>
                <ContactForm />
            </CardContent>
        </Card>
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
