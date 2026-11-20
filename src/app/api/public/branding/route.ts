import { demoToolsEnabled, getSettings } from '@/lib/repository';
import { client } from '@/config/client';
import { apiSuccess, handleZodOrServerError } from '@/lib/api-utils';

/**
 * GET /api/public/branding
 * The only settings the public inquiry form needs. Never exposes templates,
 * scoring rules, integration status or anything else from the operator settings.
 */
export async function GET() {
  try {
    const settings = await getSettings();
    return apiSuccess({
      business_name: settings.business_name,
      brand_accent: settings.brand_accent,
      brand_tagline: settings.brand_tagline,
      privacy_policy_url: client.links.privacyPolicyUrl ?? null,
      demo_tools_enabled: demoToolsEnabled(),
    });
  } catch (err) {
    return handleZodOrServerError(err, 'Failed to load branding.');
  }
}
