import { z } from 'zod';

export const itemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sku: z.string().min(1, 'SKU is required'),
  type: z.enum(['RAW_MATERIAL', 'PACKAGING', 'SEMI_FINISHED', 'FINISHED_GOOD'], {
    errorMap: () => ({ message: 'Select a valid type' }),
  }),
  category: z.string().min(1, 'Category is required'),
  description: z.string().optional(),
  baseUom: z.string().min(1, 'Base UOM is required'),
  reorderLevel: z.coerce.number().min(0, 'Must be 0 or more'),
  costPrice: z.coerce.number().min(0, 'Must be 0 or more'),
  salePrice: z.coerce.number().min(0).optional().or(z.literal('')).transform((v) => v === '' ? undefined : v as number | undefined),
});

export type ItemFormValues = z.infer<typeof itemSchema>;
