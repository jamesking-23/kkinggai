/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vault uploads go through a server action; Vercel caps request bodies at 4.5 MB.
  experimental: { serverActions: { bodySizeLimit: "4.5mb" } },
  // The local embedding model runs through onnxruntime (native code) and must not be bundled.
  serverExternalPackages: [
    "@huggingface/transformers",
    "onnxruntime-node",
    "onnxruntime-web",
    "sharp",
  ],
  outputFileTracingIncludes: {
    "/api/assistant": ["./app_models/**"],
    "/assistant": ["./app_models/**"],
  },
  // Vercel runs Linux x64; leave out the other platforms' native binaries to keep the function small.
  outputFileTracingExcludes: {
    "*": [
      "**/onnxruntime-node/bin/napi-v3/darwin/**",
      "**/onnxruntime-node/bin/napi-v3/win32/**",
      "**/onnxruntime-node/bin/napi-v3/linux/arm64/**",
    ],
  },
  transpilePackages: [
    "@kkingg/ai",
    "@kkingg/assistant",
    "@kkingg/design-tokens",
    "@kkingg/module-registry",
    "@kkingg/schemas",
  ],
};

export default nextConfig;
