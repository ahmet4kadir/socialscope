/** @type {import('next').NextConfig} */
const nextConfig = {
  // @socialscope/shared ships TypeScript source directly; Next transpiles it.
  transpilePackages: ['@socialscope/shared'],
  // Native module — must stay external to the server bundle.
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
