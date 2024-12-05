import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	// TODO check game code is valid

	if (params.gameCode !== undefined) {
		return {
			gameCode: params.gameCode
		};
	}

	error(404, 'Not found');
};
