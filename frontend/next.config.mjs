/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  env: {
    NEXT_PUBLIC_API_BASE_URL:
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      (process.env.VERCEL ? "https://pricetracker-939e.vercel.app" : "http://localhost:8000"),
  },
};

export default nextConfig;
