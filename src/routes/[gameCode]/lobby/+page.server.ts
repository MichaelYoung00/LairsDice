import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { gameService } from '../../../lib/gameService';

export const load: PageServerLoad = async ({ params, url }) => {
	// TODO check game code is valid

	const playerToken = url.searchParams.get('p');

	if (params.gameCode && playerToken) {
		const game = await gameService.getGame(playerToken);

		const playerIndex = game.players.findIndex((p) => p.isCaller);

		return {
			gameCode: params.gameCode,
			playerToken,
			players: game.players,
			isHost: playerIndex === 0
		};
	}

	error(404, 'Not found');
};
