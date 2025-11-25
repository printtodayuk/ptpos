import { ContactList } from '@/components/contacts/contact-list';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ContactListPage() {
  return (
    <div className="flex flex-col gap-6">
        <CardHeader className="p-0">
            <CardTitle>Customer Contact List</CardTitle>
            <CardDescription>A list of all contacts submitted through the public form.</CardDescription>
        </CardHeader>
        <ContactList />
    </div>
  );
}
