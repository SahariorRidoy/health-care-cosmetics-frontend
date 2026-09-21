'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingSpinner } from '@/components/feedback';
import { useGetFinanceSummaryQuery } from '@/features/finance/services/financeApi';
import {
  useGetSalesSummaryQuery,
  useGetProductionSummaryQuery,
  useGetStockBalanceReportQuery,
  useGetPurchaseSummaryQuery,
  useGetAttendanceSummaryReportQuery,
  useGetPayrollSummaryReportQuery,
} from '@/features/reports/services/reportsApi';
import { useGetItemsQuery } from '@/features/inventory/services/inventoryApi';
import { useGetEmployeesQuery } from '@/features/hr/services/hrApi';
import { useGetLeavesQuery } from '@/features/hr/services/hrApi';

import { DashboardKpiRow } from '@/features/dashboard/components/DashboardKpiRow';
import { DashboardFinancePanel } from '@/features/dashboard/components/DashboardFinancePanel';
import { DashboardProductionPanel } from '@/features/dashboard/components/DashboardProductionPanel';
import { DashboardSalesPanel } from '@/features/dashboard/components/DashboardSalesPanel';
import { DashboardProcurementPanel } from '@/features/dashboard/components/DashboardProcurementPanel';
import { DashboardHRPanel } from '@/features/dashboard/components/DashboardHRPanel';
import { DashboardLowStockPanel } from '@/features/dashboard/components/DashboardLowStockPanel';

export default function DashboardPage() {
  const { data: finData,      isLoading: finLoading }      = useGetFinanceSummaryQuery({});
  const { data: salesData,    isLoading: salesLoading }    = useGetSalesSummaryQuery({});
  const { data: prodData,     isLoading: prodLoading }     = useGetProductionSummaryQuery({});
  const { data: stockData,    isLoading: stockLoading }    = useGetStockBalanceReportQuery({ lowStock: true, page: 1 });
  const { data: purchaseData, isLoading: purchaseLoading } = useGetPurchaseSummaryQuery({});
  const { data: attendData }  = useGetAttendanceSummaryReportQuery({});
  const { data: payrollData } = useGetPayrollSummaryReportQuery({});
  const { data: rawMatsData } = useGetItemsQuery({ type: 'RAW_MATERIAL,PACKAGING' });
  const { data: fgData }      = useGetItemsQuery({ type: 'FINISHED_GOOD' });
  const { data: empData }     = useGetEmployeesQuery({ status: 'ACTIVE' });
  const { data: leavesData }  = useGetLeavesQuery({ status: 'PENDING' });

  const fin      = finData?.data;
  const sales    = salesData?.data;
  const prod     = prodData?.data;
  const purchase = purchaseData?.data;

  const lowStockItems     = stockData?.data?.balances ?? [];
  const totalRawMats      = rawMatsData?.data?.items?.length ?? 0;
  const totalFinishedGoods = fgData?.data?.items?.length ?? 0;
  const totalEmployees    = empData?.data?.employees?.length ?? 0;
  const pendingLeaves     = leavesData?.data?.leaves?.length ?? 0;

  const prodSummary  = prod?.summary ?? [];
  const totalProduced = prodSummary.reduce((s, r) => s + r.totalOutput, 0);
  const totalWastage  = prodSummary.reduce((s, r) => s + r.totalWastage, 0);
  const inProgress    = prodSummary.find((r) => r._id === 'IN_PROGRESS')?.count ?? 0;

  const totalRevenue  = sales?.orderSummary.reduce((s, r) => s + r.totalAmount, 0) ?? 0;
  const totalOrders   = sales?.orderSummary.reduce((s, r) => s + r.count, 0) ?? 0;
  const totalExpenses = fin?.expenses.total ?? 0;
  const expenseCount  = (fin?.expenses.paid.count ?? 0) + (fin?.expenses.pending.count ?? 0);
  const netProfit     = totalRevenue - totalExpenses;

  const attendanceSummary = attendData?.data?.summary ?? [];
  const payrollTotals     = payrollData?.data?.totals ?? [];

  const isLoading = finLoading || salesLoading || prodLoading || stockLoading || purchaseLoading;

  if (isLoading) return <LoadingSpinner />;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Health Care Cosmetics Ltd. — ERP Command Center"
      />

      {/* Row 1: KPI Cards */}
      <DashboardKpiRow
        totalRevenue={totalRevenue}
        totalOrders={totalOrders}
        totalExpenses={totalExpenses}
        expenseCount={expenseCount}
        payables={fin?.payables.total ?? 0}
        supplierCount={fin?.payables.supplierCount ?? 0}
        receivables={fin?.receivables.total ?? 0}
        customerCount={fin?.receivables.customerCount ?? 0}
        netProfit={netProfit}
        inProgress={inProgress}
        lowStockCount={lowStockItems.length}
        totalEmployees={totalEmployees}
      />

      {/* Row 2: Finance */}
      <div className="mb-4">
        <DashboardFinancePanel fin={fin} sales={sales} totalRevenue={totalRevenue} />
      </div>

      {/* Row 3: Sales */}
      <div className="mb-4">
        <DashboardSalesPanel sales={sales} />
      </div>

      {/* Row 4: Procurement */}
      <div className="mb-4">
        <DashboardProcurementPanel purchase={purchase} />
      </div>

      {/* Row 5: Production */}
      <div className="mb-4">
        <DashboardProductionPanel
          prodSummary={prodSummary}
          totalProduced={totalProduced}
          totalWastage={totalWastage}
        />
      </div>

      {/* Row 6: HR */}
      <div className="mb-4">
        <DashboardHRPanel
          totalEmployees={totalEmployees}
          attendanceSummary={attendanceSummary}
          payrollTotals={payrollTotals}
          pendingLeaves={pendingLeaves}
        />
      </div>

      {/* Row 7: Low Stock */}
      <div className="mb-4">
        <DashboardLowStockPanel
          lowStockItems={lowStockItems}
          totalRawMats={totalRawMats}
          totalFinishedGoods={totalFinishedGoods}
        />
      </div>
    </>
  );
}
