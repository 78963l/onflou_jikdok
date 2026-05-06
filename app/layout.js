import "./globals.css";

export const metadata = {
  title: "직독직해 Admin",
  description: "교과서 PDF 문장 관리 및 AI 청킹 시스템",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
