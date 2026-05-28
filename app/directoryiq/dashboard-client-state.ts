export type DashboardUiInput = {
  hasData: boolean;
  loading: boolean;
  error: string | null;
  listingsCount: number;
};

export type DashboardUiState = {
  showLoading: boolean;
  showError: boolean;
  showReadinessMetrics: boolean;
  showListingsZeroState: boolean;
  showListingsTable: boolean;
};

export function deriveDashboardUiState(input: DashboardUiInput): DashboardUiState {
  const showLoading = input.loading;
  const showError = Boolean(input.error);

  if (!input.hasData) {
    return {
      showLoading,
      showError,
      showReadinessMetrics: false,
      showListingsZeroState: false,
      showListingsTable: false,
    };
  }

  return {
    showLoading,
    showError,
    showReadinessMetrics: true,
    showListingsZeroState: input.listingsCount === 0,
    showListingsTable: input.listingsCount > 0,
  };
}
