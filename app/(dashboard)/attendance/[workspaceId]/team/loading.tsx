export default function AttendanceTeamLoading() {
  return (
    <div className="flex h-screen flex-1 flex-col overflow-hidden">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mb-2 h-3 w-32 animate-pulse rounded bg-gray-100" />
        <div className="h-6 w-40 animate-pulse rounded bg-gray-200" />
      </div>

      <div className="border-b border-gray-200 bg-white px-6 py-3">
        <div className="h-7 w-36 animate-pulse rounded-md bg-gray-100" />
      </div>

      <div className="flex-1 overflow-hidden px-6 py-4">
        <div className="max-w-lg space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-50" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
