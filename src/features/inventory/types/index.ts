export type ItemType = 'RAW_MATERIAL' | 'PACKAGING' | 'SEMI_FINISHED' | 'FINISHED_GOOD';

export interface UOM {
  _id: string;
  name: string;
  symbol: string;
  description?: string;
  isActive: boolean;
}

export interface Supplier {
  _id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  balance: number;
  isActive: boolean;
}

export interface Item {
  _id: string;
  name: string;
  sku: string;
  type: ItemType;
  category?: string;
  description?: string;
  baseUom: UOM | string;
  supplier?: Supplier | string;
  currentStock: number;
  reorderLevel?: number;
  costPrice: number;
  lastPurchasePrice: number;
  salePrice?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ItemsResponse {
  success: boolean;
  data: { items: Item[] };
  pagination: { page: number; pages: number; total: number; limit: number };
}

export interface ItemResponse {
  success: boolean;
  data: { item: Item };
}

export interface UOMsResponse {
  success: boolean;
  data: { uoms: UOM[] };
  pagination: { page: number; pages: number; total: number; limit: number };
}

export interface Warehouse {
  _id: string;
  name: string;
  code: string;
  address?: string;
  isActive: boolean;
  isDefault: boolean;
}

export interface StockBalance {
  _id: string;
  item: Item | string;
  warehouse: Warehouse | string;
  quantity: number;
  updatedAt: string;
}

export type MovementType =
  | 'PURCHASE_RECEIPT' | 'PRODUCTION_ISSUE' | 'PRODUCTION_OUTPUT'
  | 'SALES_DISPATCH' | 'ADJUSTMENT' | 'TRANSFER'
  | 'RETURN_SUPPLIER' | 'RETURN_CUSTOMER';

export interface StockMovement {
  _id: string;
  type: MovementType;
  item: Item | string;
  warehouse: Warehouse | string;
  quantity: number;
  balanceAfter: number;
  reference?: string;
  usageQty?: number;
  usageUom?: { _id: string; symbol: string } | string;
  notes?: string;
  createdAt: string;
}

export interface PopulatedMovementItem {
  _id: string;
  name: string;
  sku: string;
  type?: ItemType;
  costPrice?: number;
  baseUom?: { _id: string; symbol: string } | string;
}

export interface StockBalancesResponse {
  success: boolean;
  data: { balances: StockBalance[] };
  pagination: { page: number; pages: number; total: number; limit: number };
}

export interface StockMovementsResponse {
  success: boolean;
  data: { movements: StockMovement[] };
  pagination: { page: number; pages: number; total: number; limit: number };
}

export interface WarehousesResponse {
  success: boolean;
  data: { warehouses: Warehouse[] };
}

export interface CreateItemPayload {
  name: string;
  sku: string;
  type: ItemType;
  description?: string;
  baseUom: string;
  supplier: string;
  unitPrice: number;
  quantity: number;
  warehouse: string;
  costPrice?: number;
  salePrice?: number;
  notes?: string;
  expectedDeliveryDate?: string;
}
