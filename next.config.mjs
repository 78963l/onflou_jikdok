/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse와 같이 네이티브 모듈을 사용하는 패키지는 번들링 제외
  serverExternalPackages: ['pdf-parse', '@prisma/client', '.prisma'],

  // PDF 업로드를 위해 요청 크기 제한 증가
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },

  // 정적 파일 캐시 헤더
  async headers() {
    return [
      {
        source: '/uploads/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000' },
        ],
      },
    ];
  },
};

export default nextConfig;
