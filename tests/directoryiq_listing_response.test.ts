import { describe, expect, it } from "vitest";

import {
  extractBdListingRows,
  hasBdListingLikeRows,
  isBdListingLikeRow,
} from "@/app/api/directoryiq/_utils/listingResponse";

describe("directoryiq shared listings response contract", () => {
  it("extracts rows from message list", () => {
    const payload = {
      status: "success",
      message: [{ group_id: "1", group_name: "Alpha" }],
    };

    const rows = extractBdListingRows(payload);
    expect(rows).toHaveLength(1);
    expect(rows[0].group_id).toBe("1");
    expect(hasBdListingLikeRows(rows)).toBe(true);
  });

  it("extracts rows from data list", () => {
    const payload = {
      status: "success",
      message: [],
      data: [{ group_id: "2", group_name: "Beta" }],
    };

    const rows = extractBdListingRows(payload);
    expect(rows).toHaveLength(1);
    expect(rows[0].group_id).toBe("2");
    expect(hasBdListingLikeRows(rows)).toBe(true);
  });

  it("extracts rows from nested message.posts", () => {
    const payload = {
      status: "success",
      message: {
        posts: [{ group_id: "3", group_name: "Gamma", group_filename: "gamma" }],
      },
    };

    const rows = extractBdListingRows(payload);
    expect(rows).toHaveLength(1);
    expect(rows[0].group_id).toBe("3");
    expect(hasBdListingLikeRows(rows)).toBe(true);
  });

  it("rejects wrapper-success rows that are not listing-like", () => {
    const rows = extractBdListingRows({
      status: "success",
      message: [{ post_id: "900", post_title: "Blog Row" }],
    });

    expect(rows).toHaveLength(1);
    expect(isBdListingLikeRow(rows[0])).toBe(false);
    expect(hasBdListingLikeRows(rows)).toBe(false);
  });
});

