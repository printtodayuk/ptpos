import { ContactList } from '@/components/contacts/contact-list';
import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BulkUploadDialog } from '@/components/contacts/bulk-upload-dialog';

export default function ContactListPage() {
  return (
    <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardHeader className="p-0">
                <CardTitle>Customer Contact List</CardTitle>
                <CardDescription>A list of all contacts submitted through the system.</CardDescription>
            </CardHeader>
            <BulkUploadDialog />
        </div>
        <ContactList />
    </div>
  );
}
