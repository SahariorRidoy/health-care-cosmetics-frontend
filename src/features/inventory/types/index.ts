export type ItemType = 'RAW_MATERIAL' | 'PACKAGING' | 'SEMI_FINISHED' | 'FINISHED_GOOD';

export interface UOM {
  _id: string;
  name: string;
  symbol: string;
  description?: string;
  isActive: boolean;
}

export interface Item {
  _id: string;
  name: string;
  sku: string;
  type: ItemType;
  category: string;
  description?: string;
  baseUom: UOM | string;
  reorderLevel: number;
  currentStock: number;
  costPrice: number;
  salePrice?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ItemsResponse {
  success: boolean;
  data: Item[];
  pagination: { page: number; pages: number; total: number; limit: number };
}

export interface ItemResponse {
  success: boolean;
  data: Item;
}

export interface UOMsResponse {
  success: boolean;
  data: UOM[];
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
  notes?: string;
  createdAt: string;
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
  data: Warehouse[];
}

export interface CreateItemPayload {
  name: string;
  sku: string;
  type: ItemType;
  category: string;
  description?: string;
  baseUom: string;
  reorderLevel: number;
  costPrice: number;
  salePrice?: number;
}
