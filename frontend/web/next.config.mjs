/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/v1/auth/:path*',
        destination: 'http://localhost:8011/v1/auth/:path*',
      },
      {
        source: '/v1/profile/:path*',
        destination: 'http://localhost:8002/v1/profile/:path*',
      },
      {
        source: '/v1/predict/:path*',
        destination: 'http://localhost:8003/v1/predict/:path*',
      },
      {
        source: '/v1/career/:path*',
        destination: 'http://localhost:8004/v1/career/:path*',
      },
      {
        source: '/v1/notifications/:path*',
        destination: 'http://localhost:8005/v1/notifications/:path*',
      },
      {
        source: '/v1/counsel/:path*',
        destination: 'http://localhost:8006/v1/counsel/:path*',
      },
      {
        source: '/v1/counseling/:path*',
        destination: 'http://localhost:8006/v1/counseling/:path*',
      },
      {
        source: '/v1/chat/:path*',
        destination: 'http://localhost:8006/v1/chat/:path*',
      },
      {
        source: '/v1/outcomes/:path*',
        destination: 'http://localhost:8007/v1/outcomes/:path*',
      },
      {
        source: '/v1/analytics/:path*',
        destination: 'http://localhost:8007/v1/analytics/:path*',
      },
    ];
  },
};

export default nextConfig;
