import { describe, expect, it } from "vitest";
import { deriveDashboardUiState } from "@/app/(brains)/directoryiq/dashboard-client-state";

describe("deriveDashboardUiState", () => {
  it("does not render zero-state when request failed before any data load", () => {
    const state = deriveDashboardUiState({
      hasData: false,
      loading: false,
      error: "The string did not match the expected pattern.",
      listingsCount: 0,
    });

    expect(state.showError).toBe(true);
    expect(state.showReadinessMetrics).toBe(false);
    expect(state.showListingsZeroState).toBe(false);
    expect(state.showListingsTable).toBe(false);
  });

  it("renders true empty-state only when valid data is present with zero listings", () => {
    const state = deriveDashboardUiState({
      hasData: true,
      loading: false,
      error: null,
      listingsCount: 0,
    });

    expect(state.showError).toBe(false);
    expect(state.showReadinessMetrics).toBe(true);
    expect(state.showListingsZeroState).toBe(true);
    expect(state.showListingsTable).toBe(false);
  });

  it("renders listings table when valid data has listings", () => {
    const state = deriveDashboardUiState({
      hasData: true,
      loading: false,
      error: null,
      listingsCount: 2,
    });

    expect(state.showReadinessMetrics).toBe(true);
    expect(state.showListingsZeroState).toBe(false);
    expect(state.showListingsTable).toBe(true);
  });
});
