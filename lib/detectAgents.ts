// Auto-detect language, framework, and patterns from code input
// and recommend the most relevant audit agents.

interface Detection {
  language: string | null;
  framework: string | null;
  patterns: string[];
  recommendedAgents: string[];
}

interface Rule {
  pattern: RegExp;
  tags: string[];
}

const LANGUAGE_RULES: Rule[] = [
  { pattern: /\b(import|export)\s+(default\s+)?(\{|function|class|const|type|interface)\b/, tags: ['typescript', 'javascript'] },
  { pattern: /\binterface\s+\w+\s*\{/, tags: ['typescript'] },
  { pattern: /:\s*(string|number|boolean|void|any|unknown)\b/, tags: ['typescript'] },
  { pattern: /\bdef\s+\w+\s*\(.*\)\s*(->\s*\w+)?:/, tags: ['python'] },
  { pattern: /\bfrom\s+\w+\s+import\b/, tags: ['python'] },
  { pattern: /\bfunc\s+\w+\s*\(/, tags: ['go'] },
  { pattern: /\bpackage\s+main\b/, tags: ['go'] },
  { pattern: /\bfn\s+\w+\s*\(/, tags: ['rust'] },
  { pattern: /\bpub\s+(fn|struct|enum|mod)\b/, tags: ['rust'] },
  { pattern: /\bpublic\s+(static\s+)?void\s+main\b/, tags: ['java'] },
  { pattern: /\bclass\s+\w+\s+extends\b/, tags: ['java', 'typescript'] },
  { pattern: /<\?php\b/, tags: ['php'] },
  { pattern: /\bclass\s+\w+\s*<\s*ActiveRecord::Base\b/, tags: ['ruby'] },
  { pattern: /\bdo\s+\|.*\|\s*$/, tags: ['ruby'] },
];

const FRAMEWORK_RULES: Rule[] = [
  { pattern: /\b(useState|useEffect|useRef|useMemo|useCallback)\b/, tags: ['react'] },
  { pattern: /\bfrom\s+['"]react['"]/, tags: ['react'] },
  { pattern: /\b(getServerSideProps|getStaticProps|NextResponse|NextRequest)\b/, tags: ['nextjs'] },
  { pattern: /\bfrom\s+['"]next\//, tags: ['nextjs'] },
  { pattern: /\b(app\.get|app\.post|app\.use|express\(\))\b/, tags: ['express'] },
  { pattern: /\bfrom\s+['"](vue|@vue\/)\b/, tags: ['vue'] },
  { pattern: /\bfrom\s+['"]@angular\//, tags: ['angular'] },
  { pattern: /\bfrom\s+['"](fastapi|flask|django)\b/i, tags: ['python-web'] },
  { pattern: /\bfrom\s+['"](prisma|drizzle-orm|typeorm|sequelize)\b/, tags: ['orm'] },
  { pattern: /\b(GraphQLSchema|gql`|type\s+Query\s*\{)\b/, tags: ['graphql'] },
  { pattern: /\b(WebSocket|socket\.io|ws\.on)\b/i, tags: ['websocket'] },
  { pattern: /\b(Dockerfile|FROM\s+\w+:)/m, tags: ['docker'] },
  { pattern: /\b(github\.com\/|go\.mod)\b/, tags: ['go'] },
];

const PATTERN_RULES: Rule[] = [
  { pattern: /\b(SELECT|INSERT|UPDATE|DELETE|CREATE\s+TABLE)\b/i, tags: ['sql'] },
  { pattern: /\b(process\.env|import\.meta\.env|os\.environ)\b/, tags: ['env-config'] },
  { pattern: /\b(fetch|axios|XMLHttpRequest|\.get\(|\.post\()\b/, tags: ['api'] },
  { pattern: /\b(localStorage|sessionStorage|cookie|setCookie)\b/i, tags: ['client-storage'] },
  { pattern: /\b(bcrypt|argon2|jwt|jsonwebtoken|passport|auth|login|signup)\b/i, tags: ['auth'] },
  { pattern: /\b(test|describe|it|expect|jest|vitest|mocha|pytest)\b/, tags: ['testing'] },
  { pattern: /\b(console\.log|logger\.|winston|pino|log\.)\b/, tags: ['logging'] },
  { pattern: /\b(cache|redis|memcache|lru|ttl)\b/i, tags: ['caching'] },
  { pattern: /\b(Worker|Thread|spawn|fork|Promise\.all|async|await)\b/, tags: ['concurrency'] },
  { pattern: /\b(regex|RegExp|\/.*\/[gim])\b/, tags: ['regex'] },
  { pattern: /\b(aria-|role=|tabIndex|alt=|sr-only)\b/, tags: ['accessibility'] },
  { pattern: /\b(@media|responsive|breakpoint|min-width|max-width)\b/, tags: ['responsive'] },
  { pattern: /\b(dark:|prefers-color-scheme|theme)\b/, tags: ['dark-mode'] },
  { pattern: /\b(i18n|intl|locale|t\(|useTranslation)\b/i, tags: ['i18n'] },
  { pattern: /\b(form|input|validate|schema|zod|yup)\b/i, tags: ['forms'] },
  { pattern: /\b(migration|migrate|alter\s+table|add\s+column)\b/i, tags: ['migrations'] },
  { pattern: /\b(rate.?limit|throttle|debounce)\b/i, tags: ['rate-limiting'] },
  { pattern: /\b(error|catch|throw|try|Error\b|exception)\b/i, tags: ['error-handling'] },
  { pattern: /\b(paginate|pagination|offset|cursor|limit)\b/i, tags: ['pagination'] },
  { pattern: /\b(openapi|swagger|paths:|\/api\/)\b/i, tags: ['openapi'] },
  { pattern: /\b(state.?machine|xstate|transition|finite)\b/i, tags: ['state-machines'] },
  { pattern: /\b(cors|Access-Control-Allow|origin)\b/i, tags: ['cors'] },
  { pattern: /\b(email|smtp|sendgrid|resend|nodemailer)\b/i, tags: ['email'] },
  { pattern: /\b(bundle|webpack|vite|rollup|esbuild|chunk)\b/i, tags: ['bundle'] },
  { pattern: /\b(monitor|metric|trace|opentelemetry|prometheus|grafana)\b/i, tags: ['observability'] },
  { pattern: /\b(CI|CD|pipeline|github.?action|deploy|Jenkinsfile)\b/i, tags: ['ci-cd'] },
  { pattern: /\b(container|k8s|kubernetes|helm|pod)\b/i, tags: ['container'] },
  { pattern: /\b(unused|dead.?code|deprecated|TODO|FIXME|HACK|noinspection|eslint-disable)\b/i, tags: ['bloat'] },
  { pattern: /\b(hero|cta|landing.?page|call.?to.?action|conversion|headline|tagline|sign.?up)\b/i, tags: ['marketing'] },
  { pattern: /\b(README|onboard|CONTRIBUTING|developer.?guide|getting.?started)\b/i, tags: ['dx'] },
];

// Map detected tags to agent IDs
const TAG_TO_AGENTS: Record<string, string[]> = {
  'typescript': ['typescript-strictness', 'code-quality'],
  'javascript': ['code-quality', 'frontend-performance'],
  'python': ['code-quality', 'performance'],
  'go': ['code-quality', 'performance', 'concurrency'],
  'rust': ['code-quality', 'performance', 'concurrency'],
  'java': ['code-quality', 'architecture', 'performance'],
  'php': ['code-quality', 'security'],
  'ruby': ['code-quality', 'security'],
  'react': ['react-patterns', 'frontend-performance', 'accessibility'],
  'nextjs': ['react-patterns', 'seo-performance', 'frontend-performance', 'seo-technical'],
  'express': ['api-design', 'security', 'rate-limiting', 'error-handling'],
  'vue': ['frontend-performance', 'accessibility', 'code-quality'],
  'angular': ['frontend-performance', 'accessibility', 'code-quality', 'architecture'],
  'python-web': ['api-design', 'security', 'performance'],
  'orm': ['sql', 'database-infra', 'database-migrations'],
  'graphql': ['graphql', 'api-design', 'security'],
  'websocket': ['websocket', 'security', 'performance'],
  'docker': ['devops', 'container-security', 'ci-cd'],
  'sql': ['sql', 'database-infra', 'data-security'],
  'env-config': ['env-config', 'security'],
  'api': ['api-design', 'cors-headers', 'security'],
  'client-storage': ['security', 'privacy', 'data-security'],
  'auth': ['auth-review', 'security', 'privacy'],
  'testing': ['test-quality', 'code-quality'],
  'logging': ['logging', 'observability'],
  'caching': ['caching', 'performance'],
  'concurrency': ['concurrency', 'performance'],
  'regex': ['regex-review'],
  'accessibility': ['accessibility', 'ux-review'],
  'responsive': ['responsive-design', 'ux-review'],
  'dark-mode': ['dark-mode', 'design-system'],
  'i18n': ['i18n'],
  'forms': ['forms-validation', 'accessibility'],
  'migrations': ['database-migrations', 'database-infra'],
  'rate-limiting': ['rate-limiting', 'security'],
  'error-handling': ['error-handling', 'code-quality'],
  'pagination': ['pagination', 'api-design'],
  'openapi': ['openapi', 'api-design'],
  'state-machines': ['state-machines', 'architecture'],
  'cors': ['cors-headers', 'security'],
  'email': ['email-templates'],
  'bundle': ['bundle-size', 'frontend-performance'],
  'observability': ['observability', 'logging'],
  'ci-cd': ['ci-cd', 'devops'],
  'container': ['container-security', 'devops', 'cloud-infra'],
  'bloat': ['code-bloat', 'code-quality'],
  'marketing': ['marketing-pain-points'],
  'dx': ['developer-pain-points'],
};

// Always-relevant agents added when any code is detected
const UNIVERSAL_AGENTS = ['security', 'code-quality'];

// PERF-003: Truncate input before regex battery — most language signals appear
// in imports/headers (first 1KB) or file-type markers (last 500B).
const SAMPLE_HEAD = 1_000;
const SAMPLE_TAIL = 500;

function sampleInput(input: string): string {
  if (input.length <= SAMPLE_HEAD + SAMPLE_TAIL) return input;
  return input.slice(0, SAMPLE_HEAD) + input.slice(-SAMPLE_TAIL);
}

export function detectAgents(input: string): Detection {
  if (input.length < 10) {
    return { language: null, framework: null, patterns: [], recommendedAgents: [] };
  }

  const sample = sampleInput(input);
  const detectedTags = new Set<string>();
  let language: string | null = null;
  let framework: string | null = null;

  // Check language
  for (const rule of LANGUAGE_RULES) {
    if (rule.pattern.test(sample)) {
      for (const tag of rule.tags) detectedTags.add(tag);
      if (!language) language = rule.tags[0];
    }
  }

  // Check frameworks
  for (const rule of FRAMEWORK_RULES) {
    if (rule.pattern.test(sample)) {
      for (const tag of rule.tags) detectedTags.add(tag);
      if (!framework) framework = rule.tags[0];
    }
  }

  // Check patterns
  for (const rule of PATTERN_RULES) {
    if (rule.pattern.test(sample)) {
      for (const tag of rule.tags) detectedTags.add(tag);
    }
  }

  // Map tags to agent IDs
  const agentSet = new Set<string>();
  for (const tag of detectedTags) {
    const agents = TAG_TO_AGENTS[tag];
    if (agents) {
      for (const id of agents) agentSet.add(id);
    }
  }

  // Add universal agents if we detected anything
  if (detectedTags.size > 0) {
    for (const id of UNIVERSAL_AGENTS) agentSet.add(id);
  }

  return {
    language,
    framework,
    patterns: [...detectedTags],
    recommendedAgents: [...agentSet],
  };
}
