export interface BOMInput {
  item: { _id: string; name: string; sku: string } | string;
  qty: number;
  uom: { _id: string; name: string; symbol: string } | string;
}

export interface BOM {
  _id: string;
  product: { _id: string; name: string; sku: string } | string;
  version: string;
  inputMaterials: BOMInput[];
  expectedOutputQty: number;
  outputUom: { _id: string; name: string; symbol: string } | string;
  wastagePercent: number;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ProductionStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED';

export interface MaterialLine {
  item: { _id: string; name: string; sku: string } | string;
  uom: { _id: string; name: string; symbol: string } | string;
  plannedQty: number;
  issuedQty: number;
  actualConsumedQty: number;
}

export interface ProductionOrder {
  _id: string;
  woNumber: string;
  bom: BOM | string;
  product: { _id: string; name: string; sku: string } | string;
  warehouse: { _id: string; name: string } | string;
  plannedQty: number;
  actualOutputQty: number;
  wastageQty: number;
  totalMaterialCost: number;
  costPerUnit: number;
  status: ProductionStatus;
  materials: MaterialLine[];
  startDate?: string;
  completedDate?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BOMsResponse {
  success: boolean;
  data: { boms: BOM[] };
  pagination: { page: number; pages: number; total: number; limit: number };
}

export interface BOMResponse {
  success: boolean;
  data: { bom: BOM };
}

export interface ProductionOrdersResponse {
  success: boolean;
  data: { productionOrders: ProductionOrder[] };
  pagination: { page: number; pages: number; total: number; limit: number };
}

export interface ProductionOrderResponse {
  success: boolean;
  data: { productionOrder: ProductionOrder };
}

export interface AvailabilityResult {
  item: { _id: string; name: string; sku: string };
  required: number;
  available: number;
  sufficient: boolean;
}

export interface AvailabilityResponse {
  success: boolean;
  data: { available: boolean; lines: AvailabilityResult[] };
}
