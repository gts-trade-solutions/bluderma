export default function FormAlert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success";
  children: React.ReactNode;
}) {
  const isError = tone === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm ${
        isError
          ? "bg-rose-500/[12%] text-rose-200 ring-1 ring-inset ring-rose-400/25"
          : "bg-teal-500/[12%] text-teal-200 ring-1 ring-inset ring-teal-300/25"
      }`}
    >
      <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0" fill="currentColor">
        {isError ? (
          <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4.5a.9.9 0 0 1 .9.9v3.4a.9.9 0 1 1-1.8 0V7.4a.9.9 0 0 1 .9-.9Zm0 7.9a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
        ) : (
          <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-.7 11.3L5.8 9.8l1.3-1.3 2.2 2.2 4.1-4.1 1.3 1.3-5.4 5.4Z" />
        )}
      </svg>
      <span>{children}</span>
    </div>
  );
}
