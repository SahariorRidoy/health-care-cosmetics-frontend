export interface Customer {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  balance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerPayment {
  _id: string;
  receiptNumber: string;
  customer: Customer | string;
  invoice: { _id: string; invoiceNumber: string; totalAmount: number } | string;
  amount: number;
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
  salesOrder?: { orderNumber: string } | string;
  createdAt: string;
}

export interface CustomerDues {
  customer: { _id: string; name: string };
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

export type SalesOrderStatus = 'DRAFT' | 'CONFIRMED' | 'DISPATCHED' | 'CLOSED' | 'CANCELLED';
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
  customer: Customer | string;
  warehouse: { _id: string; name: string } | string;
  items: SalesOrderItem[];
  subtotal: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  totalAmount: number;
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
  customer: Customer | string;
  salesOrder?: { _id: string; orderNumber: string } | string;
  items: InvoiceItem[];
  subtotal: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: InvoiceStatus;
  dueDate?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// API response shapes
export interface CustomersResponse {
  success: boolean;
  data: { customers: Customer[] };
  pagination: { page: number; pages: number; total: number; limit: number };
}
export interface CustomerResponse {
  success: boolean;
  data: { customer: Customer };
}
export interface CustomerDuesResponse {
  success: boolean;
  data: CustomerDues;
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
export interface CustomerPaymentResponse {
  success: boolean;
  data: { payment: CustomerPayment };
}
