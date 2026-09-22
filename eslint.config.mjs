import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextVitals,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      // Deno (Edge Functions) y el servicio ClamAV (Node CommonJS) no son parte de la app Next.js
      "supabase/functions/verificar-documento/**",
      "services/**",
    ],
  },
];

export default eslintConfig;
