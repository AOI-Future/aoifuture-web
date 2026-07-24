export function resolveNewsPublicationMode(vercelEnv) {
  return vercelEnv === 'production' ? 'production' : 'review';
}