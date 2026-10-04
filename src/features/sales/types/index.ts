export interface Dealer {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  commissionRate: number;
  balance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerPayment {
  _id: string;
  receiptNumber: string;
  dealer: Dealer | string;
  invoice: { _id: string; invoiceNumber: string; totalAmount: number } | string;
  amount: number;
  changeAmount?: number;
  paymentDate: string;
  method: string;
  reference?: string;
  notes?: string;
  createdAt: string;
}

export interface InvoiceSummary {
  _id: string;
  invoiceNumber: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
  dueDate?: string;
  commissionRate: number;
  commissionAmount: number;
  salesOrder?: { orderNumber: string } | string;
  createdAt: string;
}

export interface DealerDues {
  dealer: { _id: string; name: string; commissionRate: number };
  outstandingBalance: number;
  aging: {
    current: number;
    days1_30: number;
    days31_60: number;
    days61_90: number;
    over90: number;
  };
  invoices: InvoiceSummary[];
  payments: CustomerPayment[];
}

export type SalesOrderStatus = 'ACTIVE' | 'CANCELLED';
export type InvoiceStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'CANCELLED';

export interface SalesOrderItem {
  item: { _id: string; name: string; sku: string } | string;
  description?: string;
  qty: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  uom: { _id: string; name: string; symbol: string } | string;
}

export interface SalesOrder {
  _id: string;
  orderNumber: string;
  dealer: Dealer | string;
  warehouse: { _id: string; name: string } | string;
  items: SalesOrderItem[];
  subtotal: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  commissionRate: number;
  commissionAmount: number;
  invoiceId?: string | null;
  status: SalesOrderStatus;
  notes?: string;
  deliveryDate?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  item: { _id: string; name: string; sku: string } | string;
  description?: string;
  qty: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  uom: { _id: string; name: string; symbol: string } | string;
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  dealer: Dealer | string;
  salesOrder?: { _id: string; orderNumber: string } | string;
  items: InvoiceItem[];
  subtotal: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  commissionRate: number;
  commissionAmount: number;
  status: InvoiceStatus;
  dueDate?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// API response shapes
export interface DealersResponse {
  success: boolean;
  data: { dealers: Dealer[] };
  pagination: { page: number; pages: number; total: number; limit: number };
}
export interface DealerResponse {
  success: boolean;
  data: { dealer: Dealer };
}
export interface DealerDuesResponse {
  success: boolean;
  data: DealerDues;
}
export interface CustomerPaymentsResponse {
  success: boolean;
  data: { payments: CustomerPayment[] };
  pagination: { page: number; pages: number; total: number; limit: number };
}
export interface SalesOrdersResponse {
  success: boolean;
  data: { salesOrders: SalesOrder[] };
  pagination: { page: number; pages: number; total: number; limit: number };
}
export interface SalesOrderResponse {
  success: boolean;
  data: { salesOrder: SalesOrder };
}
export interface InvoicesResponse {
  success: boolean;
  data: { invoices: Invoice[] };
  pagination: { page: number; pages: number; total: number; limit: number };
}
export interface InvoiceResponse {
  success: boolean;
  data: { invoice: Invoice };
}
export interface AllPaymentsResponse {
  success: boolean;
  data: { payments: CustomerPayment[] };
  pagination: { page: number; pages: number; total: number; limit: number };
}
export interface CustomerPaymentResponse {
  success: boolean;
  data: { payment: CustomerPayment };
}
