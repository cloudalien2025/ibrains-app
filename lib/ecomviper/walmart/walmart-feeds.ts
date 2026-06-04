import "server-only";

import crypto from "crypto";
import { appendActivityLog } from "@/lib/ecomviper/core/activity-log";
import { getWalmartConnectionHealth } from "@/lib/ecomviper/walmart/walmart-auth";
import { getFeedById, listFeeds, prependFeed, updateFeed } from "@/lib/ecomviper/walmart/walmart-store";
import type { WalmartFeedSubmission } from "@/lib/ecomviper/walmart/walmart-types";

export function submitWalmartMaintenanceFeed(payload: unknown): WalmartFeedSubmission {
  const now = new Date().toISOString();
  const connection = getWalmartConnectionHealth();

  const submission: WalmartFeedSubmission = {
    id: `feed_submission_${crypto.randomUUID()}`,
    marketplace: "walmart",
    feedId: `wm_feed_${crypto.randomUUID().slice(0, 12)}`,
    feedType: "MP_MAINTENANCE",
    status: "UNKNOWN",
    submittedPayload: payload,
    responsePayload: {
      note: "Production write disabled until preview/validation is complete.",
      connectionStatus: connection.connectionStatus,
    },
    errorReport: [],
    submittedAt: now,
    completedAt: null,
  };

  prependFeed(submission);

  appendActivityLog({
    marketplace: "walmart",
    actionType: "feed_submit",
    result: "warning",
    message: "Production write disabled until preview/validation is complete.",
    afterPayload: {
      feedId: submission.feedId,
      status: submission.status,
    },
  });

  return submission;
}

export function listWalmartFeedSubmissions() {
  return listFeeds();
}

export function getWalmartFeedStatus(feedId: string) {
  const submission = getFeedById(feedId);

  if (!submission) {
    throw new Error("Feed not found");
  }

  const updated = updateFeed(feedId, {
    status: submission.status,
  });

  appendActivityLog({
    marketplace: "walmart",
    actionType: "feed_status_check",
    result: updated.status === "ERROR" ? "error" : "success",
    message: `Feed ${updated.feedId} is ${updated.status}.`,
    afterPayload: {
      feedId: updated.feedId,
      status: updated.status,
    },
  });

  return updated;
}
