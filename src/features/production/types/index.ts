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
