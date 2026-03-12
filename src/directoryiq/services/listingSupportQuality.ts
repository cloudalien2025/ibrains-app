import type { ListingSupportModel } from "@/src/directoryiq/services/listingSupportService";

export function hasMaterialSupportSignals(support: ListingSupportModel): boolean {
  const summary = support.summary;
  if (summary.lastGraphRunAt) return true;
  if (summary.inboundLinkedSupportCount > 0) return true;
  if (summary.mentionWithoutLinkCount > 0) return true;
  if (summary.outboundSupportLinkCount > 0) return true;
  if (summary.connectedSupportPageCount > 0) return true;
  if (support.inboundLinkedSupport.length > 0) return true;
  if (support.mentionsWithoutLinks.length > 0) return true;
  if (support.outboundSupportLinks.length > 0) return true;
  if (support.connectedSupportPages.length > 0) return true;
  return false;
}
