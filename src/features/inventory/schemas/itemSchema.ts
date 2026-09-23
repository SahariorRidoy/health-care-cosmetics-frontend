import { z } from 'zod';

const baseFields = {
  name: z.string().min(1, 'Name is required'),
  sku: z.string().min(1, 'SKU is required'),
  type: z.enum(['RAW_MATERIAL', 'PACKAGING', 'SEMI_FINISHED', 'FINISHED_GOOD'], {
    errorMap: () => ({ message: 'Select a valid type' }),
  }),
  description: z.string().optional(),
  baseUom: z.string().min(1, 'Base UOM is required'),
  notes: z.string().optional(),
};

export const createItemSchema = z.object({
  ...baseFields,
  supplier: z.string().min(1, 'Supplier is required'),
  warehouse: z.string().min(1, 'Warehouse is required'),
  quantity: z.coerce.number().min(0.001, 'Quantity must be greater than 0'),
  unitPrice: z.coerce.number().min(0, 'Unit price must be 0 or more'),
  reorderLevel: z.coerce.number().int().min(0).optional(),
  paidAmount: z.coerce.number().min(0).optional(),
  paymentMethod: z.string().optional(),
});

export const editItemSchema = z.object({
  ...baseFields,
  supplier: z.string().optional(),
  warehouse: z.string().min(1, 'Warehouse is required'),
  quantity: z.coerce.number().min(0.001, 'Quantity must be greater than 0'),
  unitPrice: z.coerce.number().min(0, 'Unit price must be 0 or more'),
  reorderLevel: z.coerce.number().int().min(0).optional(),
  paidAmount: z.coerce.number().min(0).optional(),
  paymentMethod: z.string().optional(),
});

export const itemSchema = createItemSchema; // kept for any external references
export type ItemFormValues = z.infer<typeof createItemSchema> & z.infer<typeof editItemSchema>;
