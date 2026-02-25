export default async function Home() {
  let apiStatus = "Unknown";

  try {
    const res = await fetch("https://api.ibrains.ai/v1/health", {
      cache: "no-store",
    });
    if (res.ok) apiStatus = "Operational";
    else apiStatus = "Degraded";
  } catch {
    apiStatus = "Offline";
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-black text-white">
      <h1 className="text-5xl font-bold mb-6">iBrains</h1>
      <p className="text-xl mb-4">
        Platform Intelligence Engine
      </p>
      <p className="text-lg mb-10 text-gray-400">
        Intelligence layer for complex platforms.
      </p>

      <div className="mb-8">
        API Status:{" "}
        <span className="font-semibold">
          {apiStatus}
        </span>
      </div>

      <a
        href="https://api.ibrains.ai/docs"
        className="px-6 py-3 bg-white text-black rounded-lg"
      >
        View API Docs
      </a>
    </main>
  );
}
