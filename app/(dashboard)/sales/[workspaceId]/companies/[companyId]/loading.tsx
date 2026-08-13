// Skeleton for a customer profile — see the pipeline route's loading.tsx.
export default function SalesCompanyLoading() {
  return (
    <div className="flex h-screen flex-1 flex-col overflow-hidden">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
            <div className="h-6 w-56 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-40 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-24 shrink-0 animate-pulse rounded-md bg-gray-100" />
            <div className="h-8 w-28 shrink-0 animate-pulse rounded-md bg-gray-200" />
          </div>
        </div>
        <div className="mt-3 flex gap-1">
          <div className="h-7 w-20 animate-pulse rounded-md bg-gray-100" />
          <div className="h-7 w-24 animate-pulse rounded-md bg-gray-100" />
        </div>
      </div>

      {/* Mirrors SalesCompanyProfile's tinted page and card grid so the
          skeleton doesn't swap layout underneath the real content. */}
      <div className="flex-1 overflow-hidden bg-[#f6f7fb] px-6 py-5">
        <div className="mx-auto max-w-6xl space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[86px] animate-pulse rounded-lg border border-gray-200 bg-white" />
            ))}
          </div>

          <div className="h-28 animate-pulse rounded-lg border border-gray-200 bg-white" />

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-lg border border-gray-200 bg-white"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
