import Sidebar from '@/components/Sidebar';

export const metadata = {
  title: '직독직해 Admin',
  description: '교과서 문장 관리 시스템',
};

export default function AdminLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-[#f1f2f4]">
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0">
        {children}
      </main>
    </div>
  );
}
