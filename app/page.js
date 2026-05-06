import { redirect } from 'next/navigation';

// 루트 접속 시 관리자 교재 관리 페이지로 리다이렉트
export default function Home() {
  redirect('/admin/textbooks');
}
