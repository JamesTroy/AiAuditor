import { prompt as codeQuality } from './code-quality';
import { prompt as security } from './security';
import { prompt as seoPerformance } from './seo-performance';
import { prompt as accessibility } from './accessibility';
import { prompt as sql } from './sql';
import { prompt as apiDesign } from './api-design';
import { prompt as devops } from './devops';
import { prompt as performance } from './performance';
import { prompt as privacy } from './privacy';
import { prompt as testQuality } from './test-quality';
import { prompt as architecture } from './architecture';
import { prompt as uxReview } from './ux-review';
import { prompt as designSystem } from './design-system';
import { prompt as responsiveDesign } from './responsive-design';
import { prompt as colorTypography } from './color-typography';
import { prompt as motionInteraction } from './motion-interaction';
import { prompt as documentation } from './documentation';
import { prompt as dependencySecurity } from './dependency-security';
import { prompt as authReview } from './auth-review';
import { prompt as frontendPerformance } from './frontend-performance';
import { prompt as caching } from './caching';
import { prompt as memoryProfiler } from './memory-profiler';
import { prompt as cloudInfra } from './cloud-infra';
import { prompt as observability } from './observability';
import { prompt as databaseInfra } from './database-infra';
import { prompt as dataSecurity } from './data-security';
import { prompt as errorHandling } from './error-handling';
import { prompt as typescriptStrictness } from './typescript-strictness';
import { prompt as reactPatterns } from './react-patterns';
import { prompt as i18n } from './i18n';
import { prompt as rateLimiting } from './rate-limiting';
import { prompt as logging } from './logging';
import { prompt as databaseMigrations } from './database-migrations';
import { prompt as concurrency } from './concurrency';
import { prompt as ciCd } from './ci-cd';
import { prompt as regexReview } from './regex-review';
import { prompt as monorepo } from './monorepo';
import { prompt as graphql } from './graphql';
import { prompt as websocket } from './websocket';
import { prompt as containerSecurity } from './container-security';
import { prompt as corsHeaders } from './cors-headers';
import { prompt as seoTechnical } from './seo-technical';
import { prompt as bundleSize } from './bundle-size';
import { prompt as formsValidation } from './forms-validation';
import { prompt as darkMode } from './dark-mode';
import { prompt as emailTemplates } from './email-templates';
import { prompt as envConfig } from './env-config';
import { prompt as openapi } from './openapi';
import { prompt as stateMachines } from './state-machines';
import { prompt as pagination } from './pagination';
import { prompt as seoBasics } from './seo-basics';
import { prompt as seoSearchEngines } from './seo-search-engines';
import { prompt as seoRankingFactors } from './seo-ranking-factors';
import { prompt as seoQuickWins } from './seo-quick-wins';
import { prompt as seoKeywordResearch } from './seo-keyword-research';
import { prompt as seoSerpAnalysis } from './seo-serp-analysis';
import { prompt as seoSearchIntent } from './seo-search-intent';
import { prompt as seoCompetitorResearch } from './seo-competitor-research';
import { prompt as seoKeywordGap } from './seo-keyword-gap';
import { prompt as marketingPainPoints } from './marketing-pain-points';
import { prompt as marketingCopywriting } from './marketing-copywriting';
import { prompt as marketingLandingPages } from './marketing-landing-pages';
import { prompt as marketingEmailCampaigns } from './marketing-email-campaigns';
import { prompt as marketingSocialMedia } from './marketing-social-media';
import { prompt as marketingBrandVoice } from './marketing-brand-voice';
import { prompt as marketingCompetitorAnalysis } from './marketing-competitor-analysis';
import { prompt as marketingPricingPage } from './marketing-pricing-page';
import { prompt as marketingOnboarding } from './marketing-onboarding';
import { prompt as marketingAnalytics } from './marketing-analytics';
import { prompt as marketingContentStrategy } from './marketing-content-strategy';
import { prompt as marketingConversionRate } from './marketing-conversion-rate';
import { prompt as marketingProductPositioning } from './marketing-product-positioning';
import { prompt as marketingGrowthLoops } from './marketing-growth-loops';
import { prompt as marketingRetention } from './marketing-retention';
import { prompt as marketingAbTesting } from './marketing-ab-testing';
import { prompt as marketingFunnel } from './marketing-funnel';
import { prompt as marketingValueProposition } from './marketing-value-proposition';
import { prompt as marketingUserResearch } from './marketing-user-research';
import { prompt as marketingGtmStrategy } from './marketing-gtm-strategy';
import { prompt as developerPainPoints } from './developer-pain-points';
import { prompt as codeBloat } from './code-bloat';
import { prompt as apiSecurity } from './api-security';
import { prompt as secretsScanner } from './secrets-scanner';
import { prompt as xssPrevention } from './xss-prevention';
import { prompt as csrfSsrf } from './csrf-ssrf';
import { prompt as cryptography } from './cryptography';
import { prompt as cloudIam } from './cloud-iam';
import { prompt as secureSdlc } from './secure-sdlc';
import { prompt as threatModeling } from './threat-modeling';
import { prompt as zeroTrust } from './zero-trust';
import { prompt as incidentResponse } from './incident-response';
import { prompt as complianceAudit } from './compliance-audit';
import { prompt as networkPerformance } from './network-performance';
import { prompt as databasePerformance } from './database-performance';
import { prompt as imageOptimization } from './image-optimization';
import { prompt as ssrPerformance } from './ssr-performance';
import { prompt as apiPerformance } from './api-performance';
import { prompt as cssPerformance } from './css-performance';
import { prompt as javascriptPerformance } from './javascript-performance';
import { prompt as animationPerformance } from './animation-performance';
import { prompt as webVitals } from './web-vitals';
import { prompt as runtimePerformance } from './runtime-performance';
import { prompt as buildPerformance } from './build-performance';
import { prompt as navigationUx } from './navigation-ux';
import { prompt as microInteractions } from './micro-interactions';
import { prompt as errorUx } from './error-ux';
import { prompt as mobileUx } from './mobile-ux';
import { prompt as dataVisualization } from './data-visualization';
import { prompt as contentDesign } from './content-design';
import { prompt as onboardingUx } from './onboarding-ux';
import { prompt as searchUx } from './search-ux';
import { prompt as tableDesign } from './table-design';
import { prompt as notificationUx } from './notification-ux';
import { prompt as spacingLayout } from './spacing-layout';
import { prompt as seoLocal } from './seo-local';
import { prompt as seoEcommerce } from './seo-ecommerce';
import { prompt as seoContentAudit } from './seo-content-audit';
import { prompt as seoLinkBuilding } from './seo-link-building';
import { prompt as seoMobile } from './seo-mobile';
import { prompt as seoInternational } from './seo-international';
import { prompt as seoSiteArchitecture } from './seo-site-architecture';
import { prompt as seoCoreWebVitals } from './seo-core-web-vitals';
import { prompt as seoStructuredData } from './seo-structured-data';
import { prompt as seoIndexation } from './seo-indexation';
import { prompt as seoVideo } from './seo-video';
import { prompt as kubernetes } from './kubernetes';
import { prompt as terraform } from './terraform';
import { prompt as serverless } from './serverless';
import { prompt as messageQueues } from './message-queues';
import { prompt as cdnConfig } from './cdn-config';
import { prompt as loadBalancing } from './load-balancing';
import { prompt as backupRecovery } from './backup-recovery';
import { prompt as monitoringAlerting } from './monitoring-alerting';
import { prompt as namingConventions } from './naming-conventions';
import { prompt as codeComments } from './code-comments';
import { prompt as solidPrinciples } from './solid-principles';
import { prompt as refactoring } from './refactoring';
import { prompt as apiContracts } from './api-contracts';
import { prompt as asyncPatterns } from './async-patterns';
import { prompt as testingStrategy } from './testing-strategy';

export const SYSTEM_PROMPTS: Readonly<Record<string, string>> = {
  'code-quality': codeQuality,
  'security': security,
  'seo-performance': seoPerformance,
  'accessibility': accessibility,
  'sql': sql,
  'api-design': apiDesign,
  'devops': devops,
  'performance': performance,
  'privacy': privacy,
  'test-quality': testQuality,
  'architecture': architecture,
  'ux-review': uxReview,
  'design-system': designSystem,
  'responsive-design': responsiveDesign,
  'color-typography': colorTypography,
  'motion-interaction': motionInteraction,
  'documentation': documentation,
  'dependency-security': dependencySecurity,
  'auth-review': authReview,
  'frontend-performance': frontendPerformance,
  'caching': caching,
  'memory-profiler': memoryProfiler,
  'cloud-infra': cloudInfra,
  'observability': observability,
  'database-infra': databaseInfra,
  'data-security': dataSecurity,
  'error-handling': errorHandling,
  'typescript-strictness': typescriptStrictness,
  'react-patterns': reactPatterns,
  'i18n': i18n,
  'rate-limiting': rateLimiting,
  'logging': logging,
  'database-migrations': databaseMigrations,
  'concurrency': concurrency,
  'ci-cd': ciCd,
  'regex-review': regexReview,
  'monorepo': monorepo,
  'graphql': graphql,
  'websocket': websocket,
  'container-security': containerSecurity,
  'cors-headers': corsHeaders,
  'seo-technical': seoTechnical,
  'bundle-size': bundleSize,
  'forms-validation': formsValidation,
  'dark-mode': darkMode,
  'email-templates': emailTemplates,
  'env-config': envConfig,
  'openapi': openapi,
  'state-machines': stateMachines,
  'pagination': pagination,
  'seo-basics': seoBasics,
  'seo-search-engines': seoSearchEngines,
  'seo-ranking-factors': seoRankingFactors,
  'seo-quick-wins': seoQuickWins,
  'seo-keyword-research': seoKeywordResearch,
  'seo-serp-analysis': seoSerpAnalysis,
  'seo-search-intent': seoSearchIntent,
  'seo-competitor-research': seoCompetitorResearch,
  'seo-keyword-gap': seoKeywordGap,
  'marketing-pain-points': marketingPainPoints,
  'marketing-copywriting': marketingCopywriting,
  'marketing-landing-pages': marketingLandingPages,
  'marketing-email-campaigns': marketingEmailCampaigns,
  'marketing-social-media': marketingSocialMedia,
  'marketing-brand-voice': marketingBrandVoice,
  'marketing-competitor-analysis': marketingCompetitorAnalysis,
  'marketing-pricing-page': marketingPricingPage,
  'marketing-onboarding': marketingOnboarding,
  'marketing-analytics': marketingAnalytics,
  'marketing-content-strategy': marketingContentStrategy,
  'marketing-conversion-rate': marketingConversionRate,
  'marketing-product-positioning': marketingProductPositioning,
  'marketing-growth-loops': marketingGrowthLoops,
  'marketing-retention': marketingRetention,
  'marketing-ab-testing': marketingAbTesting,
  'marketing-funnel': marketingFunnel,
  'marketing-value-proposition': marketingValueProposition,
  'marketing-user-research': marketingUserResearch,
  'marketing-gtm-strategy': marketingGtmStrategy,
  'developer-pain-points': developerPainPoints,
  'code-bloat': codeBloat,
  'api-security': apiSecurity,
  'secrets-scanner': secretsScanner,
  'xss-prevention': xssPrevention,
  'csrf-ssrf': csrfSsrf,
  'cryptography': cryptography,
  'cloud-iam': cloudIam,
  'secure-sdlc': secureSdlc,
  'threat-modeling': threatModeling,
  'zero-trust': zeroTrust,
  'incident-response': incidentResponse,
  'compliance-audit': complianceAudit,
  'network-performance': networkPerformance,
  'database-performance': databasePerformance,
  'image-optimization': imageOptimization,
  'ssr-performance': ssrPerformance,
  'api-performance': apiPerformance,
  'css-performance': cssPerformance,
  'javascript-performance': javascriptPerformance,
  'animation-performance': animationPerformance,
  'web-vitals': webVitals,
  'runtime-performance': runtimePerformance,
  'build-performance': buildPerformance,
  'navigation-ux': navigationUx,
  'micro-interactions': microInteractions,
  'error-ux': errorUx,
  'mobile-ux': mobileUx,
  'data-visualization': dataVisualization,
  'content-design': contentDesign,
  'onboarding-ux': onboardingUx,
  'search-ux': searchUx,
  'table-design': tableDesign,
  'notification-ux': notificationUx,
  'spacing-layout': spacingLayout,
  'seo-local': seoLocal,
  'seo-ecommerce': seoEcommerce,
  'seo-content-audit': seoContentAudit,
  'seo-link-building': seoLinkBuilding,
  'seo-mobile': seoMobile,
  'seo-international': seoInternational,
  'seo-site-architecture': seoSiteArchitecture,
  'seo-core-web-vitals': seoCoreWebVitals,
  'seo-structured-data': seoStructuredData,
  'seo-indexation': seoIndexation,
  'seo-video': seoVideo,
  'kubernetes': kubernetes,
  'terraform': terraform,
  'serverless': serverless,
  'message-queues': messageQueues,
  'cdn-config': cdnConfig,
  'load-balancing': loadBalancing,
  'backup-recovery': backupRecovery,
  'monitoring-alerting': monitoringAlerting,
  'naming-conventions': namingConventions,
  'code-comments': codeComments,
  'solid-principles': solidPrinciples,
  'refactoring': refactoring,
  'api-contracts': apiContracts,
  'async-patterns': asyncPatterns,
  'testing-strategy': testingStrategy,
};
