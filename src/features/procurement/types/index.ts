export interface Supplier {
  _id: string;
  name: string;
  code: string;
  category: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  balance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierPayment {
  _id: string;
  paymentNumber: string;
  supplier: Supplier | string;
  purchaseOrder?: string;
  amount: number;
  paymentDate: string;
  method: string;
  reference?: string;
  notes?: string;
  createdAt: string;
}

export interface SupplierDues {
  supplier: Supplier;
  outstandingBalance: number;
  totalOrdered: number;
  totalPaid: number;
  recentPayments: SupplierPayment[];
}

export interface SuppliersResponse {
  success: boolean;
  data: { suppliers: Supplier[] };
  pagination: { page: number; pages: number; total: number; limit: number };
}

export interface SupplierResponse {
  success: boolean;
  data: { supplier: Supplier };
}

export interface SupplierPaymentsResponse {
  success: boolean;
  data: { payments: SupplierPayment[] };
  pagination: { page: number; pages: number; total: number; limit: number };
}

export interface SupplierDuesResponse {
  success: boolean;
  data: SupplierDues;
}

export type POStatus = 'DRAFT' | 'CONFIRMED' | 'RECEIVED' | 'CLOSED';

export interface POItem {
  item: { _id: string; name: string; sku: string } | string;
  description?: string;
  orderedQty: number;
  receivedQty: number;
  unitPrice: number;
  totalPrice: number;
  uom: { _id: string; name: string; symbol: string } | string;
}

export interface PurchaseOrder {
  _id: string;
  poNumber: string;
  supplier: Supplier | string;
  status: POStatus;
  items: POItem[];
  subtotal: number;
  totalAmount: number;
  notes?: string;
  expectedDeliveryDate?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GRItem {
  item: { _id: string; name: string; sku: string } | string;
  orderedQty: number;
  receivedQty: number;
  unitPrice: number;
  totalPrice: number;
  uom: { _id: string; symbol: string } | string;
  batchNumber?: string;
  expiryDate?: string;
}

export interface GoodsReceipt {
  _id: string;
  grNumber: string;
  purchaseOrder: PurchaseOrder | string;
  supplier: Supplier | string;
  warehouse: { _id: string; name: string } | string;
  items: GRItem[];
  totalAmount: number;
  notes?: string;
  receivedDate: string;
  createdAt: string;
}

export interface POsResponse {
  success: boolean;
  data: { purchaseOrders: PurchaseOrder[] };
  pagination: { page: number; pages: number; total: number; limit: number };
}

export interface POResponse {
  success: boolean;
  data: { purchaseOrder: PurchaseOrder };
}

export interface GRsResponse {
  success: boolean;
  data: { goodsReceipts: GoodsReceipt[] };
  pagination: { page: number; pages: number; total: number; limit: number };
}

export interface GRResponse {
  success: boolean;
  data: { goodsReceipt: GoodsReceipt };
}

export interface CreateSupplierPayload {
  name: string;
  code: string;
  category: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
}
