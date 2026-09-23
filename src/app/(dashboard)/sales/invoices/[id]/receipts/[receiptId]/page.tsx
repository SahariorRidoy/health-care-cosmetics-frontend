'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingSpinner, ErrorState } from '@/components/feedback';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useGetCustomerPaymentQuery } from '@/features/sales/services/salesApi';
import { useAppSelector } from '@/lib/store/hooks';
import type { Customer } from '@/features/sales/types';

export default function ReceiptDetailPage() {
  const { id, receiptId } = useParams<{ id: string; receiptId: string }>();
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);
  const token = useAppSelector((s) => s.auth.accessToken);

  const { data, isLoading, isError, refetch } = useGetCustomerPaymentQuery(receiptId);
  const payment = data?.data?.payment;

  async function fetchPDF() {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';
    const res = await fetch(`${base}/sales/payments/${receiptId}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error();
    return res.blob();
  }

  async function handleDownload() {
    if (!token) return;
    setDownloading(true);
    try {
      const blob = await fetchPDF();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `Receipt-${payment?.receiptNumber ?? receiptId}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download PDF');
    } finally {
      setDownloading(false);
    }
  }

  async function handlePrint() {
    if (!token) return;
    try {
      const blob = await fetchPDF();
      const url = URL.createObjectURL(blob);
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0';
      iframe.src = url;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        iframe.contentWindow?.print();
        setTimeout(() => { document.body.removeChild(iframe); URL.revokeObjectURL(url); }, 1000);
      };
    } catch {
      toast.error('Failed to load PDF for printing');
    }
  }

  if (isLoading) return <LoadingSpinner />;
  if (isError || !payment) return <ErrorState onRetry={refetch} />;

  const customer = typeof payment.customer === 'string' ? null : payment.customer as Customer;
  const invoice = typeof payment.invoice === 'string' ? null : payment.invoice as { _id: string; invoiceNumber: string; totalAmount: number };

  return (
    <>
      <PageHeader
        title={payment.receiptNumber}
        description={`Customer: ${customer?.name ?? '—'}`}
        breadcrumbs={[
          { label: 'Sales' },
          { label: 'Invoices', href: '/sales/invoices' },
          { label: invoice?.invoiceNumber ?? id, href: `/sales/invoices/${id}` },
          { label: payment.receiptNumber },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} className="h-9 px-3 rounded-md border border-border text-sm text-foreground hover:bg-slate-50 flex items-center gap-2 transition-colors">
              <ArrowLeft size={15} /> Back
            </button>
            <button onClick={handlePrint} className="h-9 px-4 rounded-md border border-border text-sm font-medium flex items-center gap-2 hover:bg-slate-50 transition-colors">
              <Printer size={15} /> Print
            </button>
            <button onClick={handleDownload} disabled={downloading} className="h-9 px-4 rounded-md border border-border text-sm font-medium flex items-center gap-2 hover:bg-slate-50 transition-colors disabled:opacity-60">
              {downloading ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />} Download PDF
            </button>
          </div>
        }
      />

      <div className="bg-white rounded-lg border border-border p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { label: 'Receipt Number', value: payment.receiptNumber },
          { label: 'Customer', value: customer?.name },
          { label: 'Invoice', value: invoice?.invoiceNumber },
          { label: 'Payment Date', value: formatDate(payment.paymentDate, 'dd MMM yyyy, hh:mm a') },
          { label: 'Payment Method', value: payment.method.replace('_', ' ') },
          ...(payment.reference ? [{ label: 'Reference', value: payment.reference }] : []),
          {
            label: 'Amount Received',
            value: <span className="font-semibold">{formatCurrency(payment.amount + (payment.changeAmount ?? 0))}</span>,
          },
          {
            label: 'Applied Amount',
            value: <span className="font-semibold text-emerald-600">{formatCurrency(payment.amount)}</span>,
          },
          ...((payment.changeAmount ?? 0) > 0 ? [{
            label: 'Change Given',
            value: <span className="font-semibold text-blue-600">{formatCurrency(payment.changeAmount!)}</span>,
          }] : []),
          ...(invoice ? [{
            label: 'Invoice Total',
            value: formatCurrency(invoice.totalAmount),
          }] : []),
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-muted uppercase tracking-wide">{label}</span>
            <span className="text-sm text-foreground">{value ?? '—'}</span>
          </div>
        ))}
        {payment.notes && (
          <div className="col-span-full flex flex-col gap-0.5">
            <span className="text-xs font-medium text-muted uppercase tracking-wide">Notes</span>
            <span className="text-sm text-foreground">{payment.notes}</span>
          </div>
        )}
      </div>
    </>
  );
}
