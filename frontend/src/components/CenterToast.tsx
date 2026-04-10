/** 视口居中短时提示（成功 / 信息类，与设置页一致） */
export default function CenterToast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      className="fixed left-1/2 top-1/2 z-50 max-w-[min(90vw,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-center text-sm text-emerald-800 shadow-xl"
      role="status"
    >
      {message}
    </div>
  );
}
