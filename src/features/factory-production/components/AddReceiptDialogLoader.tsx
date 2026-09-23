'use client';

import { Loader2 } from 'lucide-react';
import { useGetFactoryBatchQuery } from '../services/factoryProductionApi';
import { AddReceiptDialog } from './AddReceiptDialog';

interface Props {
  batchId: string;
  onClose: () => void;
}

export function AddReceiptDialogLoader({ batchId, onClose }: Props) {
  const { data, isLoading } = useGetFactoryBatchQuery(batchId);

  if (isLoading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Loader2 size={28} className="animate-spin text-white" />
    </div>
  );

  if (!data?.data?.factoryBatch) return null;

  return <AddReceiptDialog open batch={data.data.factoryBatch} onClose={onClose} />;
}
