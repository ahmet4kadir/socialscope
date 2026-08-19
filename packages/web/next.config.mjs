/** @type {import('next').NextConfig} */
const nextConfig = {
  // @socialscope/shared ships TypeScript source directly; Next transpiles it.
  transpilePackages: ['@socialscope/shared'],
};

export default nextConfig;
