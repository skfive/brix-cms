/**
 * Auth 레이아웃 — 배경: muted/40, 전체 화면, 카드 중앙 배치
 * 명세 §4 Auth 레이아웃 참조
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4 py-8">
      {children}
    </div>
  )
}
