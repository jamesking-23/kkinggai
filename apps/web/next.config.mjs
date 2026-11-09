/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vault uploads go through a server action; Vercel caps request bodies at 4.5 MB.
  experimental: { serverActions: { bodySizeLimit: "4.5mb" } },
  transpilePackages: [
    "@kkingg/ai",
    "@kkingg/design-tokens",
    "@kkingg/module-registry",
    "@kkingg/schemas",
  ],
};

export default nextConfig;
