import { test } from "vitest";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";

process.env.DIRECTORYIQ_DATA_ROOT = "/tmp/directoryiq-test-data";

const cacheStore = await import("../../lib/directoryiq/storage/serpCacheStore");
const draftStore = await import("../../lib/directoryiq/storage/draftStore");
const writer = await import("../../lib/directoryiq/blog_writer/v2/writer");

const reset = async () => {
  await rm("/tmp/directoryiq-test-data", { recursive: true, force: true });
};

test("enqueue/status flow transitions from queued to ready", async () => {
  await reset();
  const cache = await cacheStore.upsertQueuedSerpCache({ listing_id: "l1", slot_id: "s1", focus_keyword: "roof repair" });
  assert.equal(cache.status, "QUEUED");

  await cacheStore.updateSerpCacheById(cache.id, {
    status: "READY",
    consensus_outline: { h2Sections: [{ heading: "Cost Factors", score: 4, avgPosition: 1, h3: [] }], mustCoverQuestions: [], targetLengthBand: { min: 900, median: 1200, max: 1500 } },
  });

  const list = await cacheStore.listSerpStatus("l1");
  assert.equal(list[0].status, "READY");
});

test("generate draft uses serp outline when ready and preview data can be loaded by draft id", async () => {
  await reset();
  const entry = await cacheStore.upsertQueuedSerpCache({ listing_id: "l2", slot_id: "s2", focus_keyword: "plumber", location_modifier: "Austin" });
  await cacheStore.updateSerpCacheById(entry.id, {
    status: "READY",
    consensus_outline: { h2Sections: [{ heading: "Emergency Response Times", score: 3, avgPosition: 1, h3: [] }], mustCoverQuestions: [], targetLengthBand: { min: 900, median: 1100, max: 1400 } },
  });

  const generated = await writer.generateDirectoryIqDraft({
    listing: { listing_id: "l2", slot_id: "s2", business_name: "Demo Biz", listing_url: "https://example.com/l2", city: "Austin", state: "TX" },
    focusKeyword: "plumber",
    serpCacheId: entry.id,
  });

  const saved = await draftStore.saveDraft({
    listing_id: "l2",
    slot_id: "s2",
    post_title: generated.post_title,
    focus_keyword: "plumber",
    slug: generated.slug,
    article_markdown: generated.article_markdown,
    seo_title: generated.seo_title,
    meta_description: generated.meta_description,
    serp_outline_used: generated.serp_outline_used,
    serp_cache_id: generated.serp_cache_id,
    title_alternates: generated.title_alternates,
  });

  assert.equal(saved.serp_outline_used, true);
  assert.match(saved.article_markdown, /Emergency Response Times/);

  const loaded = await draftStore.getDraftById(saved.draft_id);
  assert.equal(loaded?.draft_id, saved.draft_id);
});

test("generate draft fallback when cache unavailable", async () => {
  await reset();
  const generated = await writer.generateDirectoryIqDraft({
    listing: { listing_id: "l3", slot_id: "s3", business_name: "Demo Biz", listing_url: "https://example.com/l3" },
    focusKeyword: "tree service",
  });
  assert.equal(generated.serp_outline_used, false);
  assert.match(generated.article_markdown, /Quick Answer/);
});
