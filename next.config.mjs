/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Allow file uploads via server actions up to 10 MB.
    serverActions: { bodySizeLimit: "10mb" },
  },
  images: {
    // Optimize images served from Supabase Storage (signed URLs).
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Clickjacking protection.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
