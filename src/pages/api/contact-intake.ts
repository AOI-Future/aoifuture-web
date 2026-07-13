import type { APIRoute } from 'astro';
import { handleContactIntake } from './consultation-intake';

export const ALL: APIRoute = ({ request }) => handleContactIntake(request);