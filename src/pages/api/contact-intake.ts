import type { APIRoute } from 'astro';
import { handleContactIntake } from './consultation-intake';

export const POST: APIRoute = ({ request }) => handleContactIntake(request);
export const OPTIONS: APIRoute = ({ request }) => handleContactIntake(request);
export const ALL: APIRoute = ({ request }) => handleContactIntake(request);