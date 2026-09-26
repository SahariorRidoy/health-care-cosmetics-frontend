export type ProductionStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED';

export interface ProductionOrder {
  _id: string;
  woNumber: string;
  product: { _id: string; name: string; sku: string } | string;
  warehouse: { _id: string; name: string } | string;
  plannedQty: number;
  actualOutputQty: number;
  wastageQty: number;
  totalMaterialCost: number;
  costPerUnit: number;
  status: ProductionStatus;
  startDate?: string;
  completedDate?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionOrdersResponse {
  success: boolean;
  data: { productionOrders: ProductionOrder[] };
  pagination: { page: number; pages: number; total: number; limit: number };
}

export interface ProductionBatchMaterial {
  item: { _id: string; name: string; sku?: string } | string;
  itemName: string;
  qtyUsed: number;
  costAtTime: number;
  uom?: { _id: string; name?: string; symbol: string } | string;
  uomSymbol?: string;
  baseUomSymbol?: string;
  baseQtyUsed?: number;
  lineCost?: number;
}

export interface ProductionBatch {
  _id: string;
  batchNumber: string;
  product: { _id: string; name: string; sku: string } | string;
  productName?: string;
  productSku?: string;
  productionOrder?: { _id: string; woNumber: string } | string;
  warehouse?: { _id: string; name: string; code?: string } | string;
  outputUom?: { _id: string; name?: string; symbol: string } | string;
  outputUomSymbol?: string;
  manufacturedDate: string;
  quantityProduced: number;
  costOfMaterials: number;
  totalProductionCost: number;
  costPerUnit: number;
  materialsUsed: ProductionBatchMaterial[];
  notes?: string;
  createdAt: string;
}

export interface ProductionBatchesResponse {
  success: boolean;
  data: { batches: ProductionBatch[] };
  pagination: { page: number; pages: number; total: number; limit: number };
}

export interface CreateProductionBatchPayload {
  productId?: string;
  newProduct?: {
    name: string;
    sku: string;
    baseUom: string;
    salePrice?: number;
    reorderLevel?: number;
  };
  warehouse: string;
  quantityProduced: number;
  materials: { item: string; qty: number; uom: string }[];
  notes?: string;
}

export interface ProductionBatchResponse {
  success: boolean;
  data: { batch: ProductionBatch };
}
