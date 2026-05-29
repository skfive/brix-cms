import { AdminShell } from '@/components/admin-shell'

/**
 * Admin 레이아웃 — 인증이 필요한 모든 관리자 페이지에 AdminShell 적용
 * 명세 §4 관리자 셸 레이아웃 참조
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
