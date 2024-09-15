import { type Game } from '../types/types';

export class GameRepository {
	private games: Game[];

	constructor() {
		this.games = [];
	}

	public async getGame(code: string): Promise<Game | undefined> {
		return this.games.find((game) => game.code === code);
	}

	public async saveGame(game: Game): Promise<void> {
		const index = this.games.findIndex((g) => g.code === game.code);
		if (index !== -1) {
			this.games[index] = game;
		} else {
			this.games.push(game);
		}
	}
}

export const gameRepository = new GameRepository();
