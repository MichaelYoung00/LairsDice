import type { GameDto } from '../types/dtos';

export interface CreateGameResponse {
	gameCode: string;
}

export async function createGame(): Promise<CreateGameResponse> {
	const response = await fetch('/api/createGame', { method: 'POST' });

	if (!response.ok) {
		throw new Error(`/createGame returned status ${response.status}`);
	}

	const json = await response.json();
	return json as CreateGameResponse;
}

export interface AddPlayerResponse {
	playerToken: string;
}

export async function addPlayer(name: string, gameCode: string): Promise<AddPlayerResponse> {
	const body = JSON.stringify({
		name,
		gameCode
	});
	const response = await fetch('/api/addPlayer', {
		method: 'POST',
		body
	});

	if (!response.ok) {
		throw new Error(`/addPlayer returned status ${response.status}`);
	}

	const json = await response.json();
	return json as AddPlayerResponse;
}

export async function startGame(playerToken: string): Promise<void> {
	const response = await fetch('/api/startGame', {
		method: 'POST',
		headers: {
			'Player-Token': playerToken
		}
	});

	if (!response.ok) {
		throw new Error(`/startGame returned status ${response.status}`);
	}
}

export type GetGameResponse = GameDto;

export async function getGame(playerToken: string): Promise<GetGameResponse> {
	const response = await fetch('/api/getGame', {
		method: 'GET',
		headers: {
			'Player-Token': playerToken
		}
	});

	if (!response.ok) {
		throw new Error(`/getGame returned status ${response.status}`);
	}

	const json = await response.json();
	return json as GetGameResponse;
}

export async function placeBid(playerToken: string, quantity: number, dice: number): Promise<void> {
	const body = JSON.stringify({
		quantity,
		dice
	});

	const response = await fetch('/api/placeBid', {
		method: 'POST',
		body,
		headers: {
			'Player-Token': playerToken
		}
	});

	if (!response.ok) {
		throw new Error(`/addPlayer returned status ${response.status}`);
	}
}

export async function challengeBid(playerToken: string): Promise<void> {
	const response = await fetch('/api/challengeBid', {
		method: 'POST',
		headers: {
			'Player-Token': playerToken
		}
	});

	if (!response.ok) {
		throw new Error(`/addPlayer returned status ${response.status}`);
	}
}
