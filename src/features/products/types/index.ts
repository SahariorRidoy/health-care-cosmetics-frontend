import type { UOM } from '@/features/inventory/types';

export interface Product {
  _id: string;
  name: string;
  sku: string;
  type: 'FINISHED_GOOD';
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

export interface ProductsResponse {
  success: boolean;
  data: { items: Product[] };
  pagination: { page: number; pages: number; total: number; limit: number };
}

export interface ProductResponse {
  success: boolean;
  data: { item: Product };
}

export interface CreateProductPayload {
  name: string;
  sku: string;
  type: 'FINISHED_GOOD';
  description?: string;
  baseUom: string;
  reorderLevel: number;
  warehouse?: string;
  quantity?: number;
  unitPrice?: number;
  costPrice?: number;
  salePrice?: number;
}
