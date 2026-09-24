import type { UOM, Warehouse, Item } from '@/features/inventory/types';

export type FactoryBatchStatus =
  | 'DRAFT'
  | 'DISPATCHED'
  | 'IN_PRODUCTION'
  | 'PARTIALLY_RECEIVED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface FactoryDispatchMaterial {
  item: Pick<Item, '_id' | 'name' | 'sku' | 'costPrice'> | string;
  qty: number;
  uom: UOM | string;
  dispatchedQty: number;
  unitCost: number;
}

export interface FactoryReceiptMaterialUsed {
  item: Pick<Item, '_id' | 'name' | 'sku'> | string;
  usedQty: number;
  uom: UOM | string;
}

export interface FactoryReceiptProduct {
  productName: string;
  linkedItem?: Pick<Item, '_id' | 'name' | 'sku'> | string;
  isNewProduct: boolean;
  newProductData?: {
    name: string;
    sku?: string;
    baseUom: string;
    salePrice?: number;
    reorderLevel?: number;
  };
  receivedQty: number;
  uom: UOM | string;
  materialsUsed: FactoryReceiptMaterialUsed[];
  materialCost: number;
  allocatedSharedCost: number;
  totalUnitCost: number;
  salePrice?: number;
}

export interface FactoryReceipt {
  _id: string;
  receiptNumber: string;
  receiptDate: string;
  deliveryCost: number;
  productionCost: number;
  otherCost: number;
  costAllocationMethod: 'PER_UNIT';
  products: FactoryReceiptProduct[];
  createdBy: { name: string } | string;
  createdAt: string;
}

export interface FactoryMaterialReturn {
  _id: string;
  returnDate: string;
  materials: { item: Pick<Item, '_id' | 'name' | 'sku'> | string; returnedQty: number; uom: UOM | string }[];
  notes?: string;
  createdBy: { name: string } | string;
  createdAt: string;
}

export interface FactoryRestockEntry {
  _id: string;
  restockDate: string;
  materials: { item: Pick<Item, '_id' | 'name' | 'sku'> | string; qty: number; uom: UOM | string; unitCost: number }[];
  notes?: string;
  createdBy: { name: string } | string;
  createdAt: string;
}

export interface Factory {
  _id: string;
  name: string;
}

export interface FactoryBatch {
  _id: string;
  fbNumber: string;
  batchName: string;
  factory: Factory | string;
  warehouse: Warehouse | string;
  status: FactoryBatchStatus;
  dispatch: {
    materials: FactoryDispatchMaterial[];
    dispatchedDate?: string;
    notes?: string;
  };
  receipts: FactoryReceipt[];
  materialReturns: FactoryMaterialReturn[];
  restockHistory: FactoryRestockEntry[];
  expectedDeliveryDate?: string;
  notes?: string;
  isActive: boolean;
  createdBy: { name: string } | string;
  createdAt: string;
  updatedAt: string;
}

// ── Response types ────────────────────────────────────────────────────────────

export interface FactoryBatchesResponse {
  success: boolean;
  data: { factoryBatches: FactoryBatch[] };
  pagination: { page: number; pages: number; total: number; limit: number };
}

export interface FactoryBatchResponse {
  success: boolean;
  data: { factoryBatch: FactoryBatch };
}

export interface FactoryLedgerResponse {
  success: boolean;
  data: {
    batches: FactoryBatch[];
    factoryStock: {
      item: Pick<Item, '_id' | 'name' | 'sku'>;
      dispatched: number;
      used: number;
      returned: number;
      remaining: number;
    }[];
  };
}

// ── Payload types ─────────────────────────────────────────────────────────────

export interface CreateFactoryBatchPayload {
  batchName: string;
  warehouse: string;
  dispatch: {
    materials: { item: string; qty: number; uom: string }[];
    notes?: string;
  };
  expectedDeliveryDate?: string;
  notes?: string;
}

export interface UpdateFactoryBatchPayload {
  batchName?: string;
  warehouse?: string;
  dispatch?: {
    materials?: { item: string; qty: number; uom: string }[];
    notes?: string;
  };
  expectedDeliveryDate?: string;
  notes?: string;
}

export interface AddReceiptProductPayload {
  productName: string;
  linkedItem?: string;
  isNewProduct: boolean;
  newProductData?: {
    name: string;
    sku?: string;
    baseUom: string;
    salePrice?: number;
    reorderLevel?: number;
  };
  receivedQty: number;
  uom: string;
  materialsUsed: { item: string; usedQty: number; uom: string }[];
  salePrice?: number;
}

export interface AddReceiptPayload {
  receiptDate: string;
  deliveryCost?: number;
  productionCost?: number;
  otherCost?: number;
  products: AddReceiptProductPayload[];
}

export interface AddMaterialReturnPayload {
  returnDate: string;
  materials: { item: string; returnedQty: number; uom: string }[];
  notes?: string;
}

export interface RestockBatchPayload {
  restockDate: string;
  materials: { item: string; qty: number; uom: string }[];
  notes?: string;
}

// ── Factory stock derived type (for UI display) ───────────────────────────────

export interface FactoryStockLine {
  itemId: string;
  itemName: string;
  itemSku: string;
  dispatched: number;
  used: number;
  returned: number;
  remaining: number;
}

// ── Legacy V1 types (kept for old factory-orders pages) ──────────────────────

export type FactoryOrderStatus = FactoryBatchStatus;

export interface FactoryMaterialLine {
  item: { _id: string; name: string; sku: string; costPrice: number } | string;
  qty: number;
  uom: UOM | string;
  dispatchedQty: number;
}

export interface FactoryExpectedProduct {
  name: string;
  expectedQty: number;
  uom: UOM | string;
  receivedQty: number;
  linkedItem?: { _id: string; name: string; sku: string } | string;
}

export interface FactoryOrder {
  _id: string;
  foNumber: string;
  orderName: string;
  warehouse: Warehouse | string;
  status: FactoryOrderStatus;
  materials: FactoryMaterialLine[];
  expectedProducts: FactoryExpectedProduct[];
  serviceCharge: number;
  totalMaterialCost: number;
  totalCost: number;
  expectedDeliveryDate?: string;
  dispatchedDate?: string;
  notes?: string;
  isActive: boolean;
  createdBy: { name: string } | string;
  createdAt: string;
  updatedAt: string;
}
