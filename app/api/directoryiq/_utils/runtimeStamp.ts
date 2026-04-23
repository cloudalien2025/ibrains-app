export type DirectoryIqRuntimeStamp = {
  runtime_owner: string;
  release_stamp: string;
};

function resolveReleaseStamp(): string {
  const candidates = [
    process.env.DIRECTORYIQ_RELEASE_STAMP,
    process.env.RELEASE_GIT_SHA,
    process.env.GIT_SHA,
    process.env.RAILWAY_GIT_COMMIT_SHA,
    process.env.RENDER_GIT_COMMIT,
    process.env.GITHUB_SHA,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return "unknown";
}

export function getDirectoryIqRuntimeStamp(runtimeOwner: string): DirectoryIqRuntimeStamp {
  return {
    runtime_owner: runtimeOwner,
    release_stamp: resolveReleaseStamp(),
  };
}
