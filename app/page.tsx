import { redirect } from 'next/navigation'

/**
 * 루트 경로(/) → 로그인 또는 대시보드로 리다이렉트
 */
export default function HomePage() {
  redirect('/login')
}
