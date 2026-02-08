
'use client';

import { useState, useEffect, useTransition } from 'react';
import { Building, Plus, Loader2, Edit, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { CompanyProfileForm } from '@/components/invoices/company-profile-form';
import { InvoiceForm } from '@/components/invoices/invoice-form';
import { InvoicesTable } from '@/components/invoices/invoices-table';
import { InvoiceViewDialog } from '@/components/invoices/invoice-view-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

import { getCompanyProfiles, deleteCompanyProfile, getInvoices, deleteInvoice } from '@/lib/server-actions-invoices';
import type { CompanyProfile, Invoice } from '@/lib/types';

export default function InvoiceGeneratorPage() {
    const [profiles, setProfiles] = useState<CompanyProfile[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isLoading, startLoading] = useTransition();
    const { toast } = useToast();

    const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
    const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
    
    const [profileToEdit, setProfileToEdit] = useState<CompanyProfile | null>(null);
    const [invoiceToEdit, setInvoiceToEdit] = useState<Invoice | null>(null);
    const [invoiceToView, setInvoiceToView] = useState<Invoice | null>(null);
    const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
    const [profileToDelete, setProfileToDelete] = useState<CompanyProfile | null>(null);

    const fetchData = () => {
        startLoading(async () => {
            const [profilesData, invoicesData] = await Promise.all([
                getCompanyProfiles(),
                getInvoices()
            ]);
            setProfiles(profilesData);
            setInvoices(invoicesData);
        });
    };

    useEffect(() => {
        fetchData();
    }, []);
    
    const handleProfileSaved = () => {
        setIsProfileDialogOpen(false);
        setProfileToEdit(null);
        toast({ title: 'Success', description: 'Company profile saved.' });
        fetchData();
    };
    
    const handleInvoiceSaved = () => {
        setIsInvoiceDialogOpen(false);
        setInvoiceToEdit(null);
        toast({ title: 'Success', description: 'Invoice saved.' });
        fetchData();
    };

    const handleEditProfile = (profile: CompanyProfile) => {
        setProfileToEdit(profile);
        setIsProfileDialogOpen(true);
    };

    const handleDeleteProfile = async () => {
        if (!profileToDelete) return;
        const result = await deleteCompanyProfile(profileToDelete.id!);
        if (result.success) {
            toast({ title: 'Success', description: 'Company profile deleted.' });
            fetchData();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.message });
        }
        setProfileToDelete(null);
    };
    
    const handleEditInvoice = (invoice: Invoice) => {
        setInvoiceToEdit(invoice);
        setIsInvoiceDialogOpen(true);
    };

    const handleViewInvoice = (invoice: Invoice) => {
        setInvoiceToView(invoice);
    };

    const handleDeleteInvoice = async () => {
        if (!invoiceToDelete) return;
        const result = await deleteInvoice(invoiceToDelete.id!);
        if (result.success) {
            toast({ title: 'Success', description: 'Invoice deleted.' });
            fetchData();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.message });
        }
        setInvoiceToDelete(null);
    };


    return (
        <div className="flex flex-col gap-6">
            <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{profileToEdit ? 'Edit' : 'Add'} Company Profile</DialogTitle>
                        <DialogDescription>
                            Manage the details for the companies you send invoices from.
                        </DialogDescription>
                    </DialogHeader>
                    <CompanyProfileForm
                        companyProfile={profileToEdit}
                        onSuccess={handleProfileSaved}
                        onCancel={() => setIsProfileDialogOpen(false)}
                    />
                </DialogContent>
            </Dialog>
            
            <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
                 <DialogContent className="sm:max-w-4xl p-0 flex flex-col h-full max-h-[90vh]">
                    <DialogHeader className="p-6 pb-4">
                        <DialogTitle>{invoiceToEdit ? 'Edit' : 'Create'} Invoice</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto px-6 pb-6">
                        <InvoiceForm
                            companyProfiles={profiles}
                            invoiceToEdit={invoiceToEdit}
                            onSuccess={handleInvoiceSaved}
                            onCancel={() => setIsInvoiceDialogOpen(false)}
                        />
                    </div>
                </DialogContent>
            </Dialog>

            <InvoiceViewDialog 
                invoice={invoiceToView}
                companyProfiles={profiles}
                isOpen={!!invoiceToView}
                onClose={() => setInvoiceToView(null)}
            />
            
            <AlertDialog open={!!invoiceToDelete} onOpenChange={() => setInvoiceToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete invoice <span className="font-bold">{invoiceToDelete?.invoiceId}</span>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteInvoice}>Continue</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            <AlertDialog open={!!profileToDelete} onOpenChange={() => setProfileToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the <span className="font-bold">{profileToDelete?.name}</span> profile. Any invoices using this profile will not be deleted but may not display correctly.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteProfile}>Continue</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>


            <CardHeader className="p-0">
                <CardTitle>Invoice Generator</CardTitle>
                <CardDescription>Manage company profiles and generate invoices.</CardDescription>
            </CardHeader>
            
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Company Profiles</CardTitle>
                        <CardDescription>The companies you can invoice from.</CardDescription>
                    </div>
                    <Button size="sm" onClick={() => { setProfileToEdit(null); setIsProfileDialogOpen(true); }}>
                        <Plus className="mr-2 h-4 w-4" /> Add Profile
                    </Button>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                         <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
                    ) : profiles.length === 0 ? (
                        <div className="text-center text-muted-foreground py-6">No company profiles created yet.</div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {profiles.map(profile => (
                                <Card key={profile.id} className="flex flex-col">
                                    <CardHeader className="flex-1">
                                        <CardTitle className="flex items-center gap-2">
                                            <Building className="h-5 w-5" />
                                            {profile.name}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardFooter className="bg-muted/50 p-2 flex justify-end gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => handleEditProfile(profile)}><Edit className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => setProfileToDelete(profile)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

             <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Invoices</CardTitle>
                        <CardDescription>All generated invoices.</CardDescription>
                    </div>
                    <Button onClick={() => { setInvoiceToEdit(null); setIsInvoiceDialogOpen(true); }} disabled={profiles.length === 0}>
                        <Plus className="mr-2 h-4 w-4" /> Create Invoice
                    </Button>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : (
                        <InvoicesTable 
                            invoices={invoices}
                            companyProfiles={profiles}
                            onEdit={handleEditInvoice}
                            onDelete={setInvoiceToDelete}
                            onView={handleViewInvoice}
                            onStatusChange={fetchData}
                        />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
    