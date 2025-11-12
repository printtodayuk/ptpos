'use server';

/**
 * @fileOverview A flow to generate invoice numbers based on the UK date.
 *
 * - generateInvoiceNumber - A function that generates a unique invoice number.
 * - GenerateInvoiceNumberInput - The input type for the generateInvoiceNumber function (currently empty).
 * - GenerateInvoiceNumberOutput - The return type for the generateInvoiceNumber function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateInvoiceNumberInputSchema = z.object({});
export type GenerateInvoiceNumberInput = z.infer<typeof GenerateInvoiceNumberInputSchema>;

const GenerateInvoiceNumberOutputSchema = z.object({
  invoiceNumber: z.string().describe('The generated invoice number.'),
});
export type GenerateInvoiceNumberOutput = z.infer<typeof GenerateInvoiceNumberOutputSchema>;

export async function generateInvoiceNumber(
  _input: GenerateInvoiceNumberInput
): Promise<GenerateInvoiceNumberOutput> {
  return generateInvoiceNumberFlow({});
}

const generateInvoiceNumberPrompt = ai.definePrompt({
  name: 'generateInvoiceNumberPrompt',
  input: {schema: GenerateInvoiceNumberInputSchema},
  output: {schema: GenerateInvoiceNumberOutputSchema},
  prompt: `You are an expert invoicing system.  Generate a unique invoice number based on the UK date (ddmmyyyy) and a sequence number.`,
});

const generateInvoiceNumberFlow = ai.defineFlow(
  {
    name: 'generateInvoiceNumberFlow',
    inputSchema: GenerateInvoiceNumberInputSchema,
    outputSchema: GenerateInvoiceNumberOutputSchema,
  },
  async () => {
    const today = new Date();
    const ukDate = today.toLocaleDateString('en-GB').replace(/\//g, '');
    const sequenceNumber = Math.floor(Math.random() * 10000);
    const invoiceNumber = `${ukDate}-${sequenceNumber}`;

    return {
      invoiceNumber: invoiceNumber,
    };
  }
);
