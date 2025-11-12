# **App Name**: Print Today EPOS

## Core Features:

- Invoice and Non-Invoice Data Entry: Capture sales data including date (auto-filled, but editable), client name, job description (optional), amount in pounds, VAT selection (with auto-calculation), total amount, payment terms (Bank Transfer, Card Payment, Cash), and reference (optional).
- Realtime Display and Print: Display entered data in real-time, most recent entries first, with a 'Print' button for each to print payment receipts optimized for a thermal printer.
- User Selection: Implement a dropdown to select the operator's name (PTMGH, PTASAD, PTM, PTITAdmin) during data entry.
- Reporting and CSV Export: Generate reports with filtering capabilities (daily/monthly sales) and CSV export for sales data.
- Admin Verification: Admin can review pending entries and mark them as 'checked'. A column will be added to the reporting CSV file to track the verification status of data by 'admin'.
- Dashboard Statistics: Dashboard providing key statistics such as daily sales, total entries, cash amount, bank amount and card amount.
- Firebase Integration: Connect the app to Firebase to persist data.

## Style Guidelines:

- Primary color: A deep sky blue (#00AEEF) evokes trust and reliability, matching the invoicing system use case.
- Background color: Light desaturated sky blue (#E0F7FA).
- Accent color: Blue violet (#7950F2) for a modern contrast.
- Body and headline font: 'Inter' sans-serif. Note: currently only Google Fonts are supported.
- Code font: 'Source Code Pro' monospace for code snippets. Note: currently only Google Fonts are supported.
- Simple and clear icons to represent actions and data categories.
- Clean and structured layout with clear sections for data input, display, and reports.
- Subtle transitions and animations to enhance user experience during data entry and display.