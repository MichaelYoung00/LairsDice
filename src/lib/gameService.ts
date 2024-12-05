import type { GameDto, PlayerDto } from '../types/dtos';
import type { IGameRepository } from '../types/interfaces';
import { GameState, type Game, type Player } from '../types/types';
import { eventService, type EventService } from './eventService';
import { GameDynamoDbRepository } from './gameDynamoDbRepository';
import { GameInMemoryRepository } from './gameInMemoryRepository';
import { Roller } from './roller';

export class GameService {
	constructor(
		private repository: IGameRepository,
		private events: EventService,
		private roller: Roller
	) {}

	public async createGame(): Promise<string> {
		const game: Game = {
			state: GameState.Lobby,
			code: this.generateCode(),
			currentPlayer: undefined,
			players: [],
			currentBid: undefined,
			maxPlayers: 3,
			initialDiceCount: 6
		};

		await this.repository.saveGame(game);

		return game.code;
	}

	public async addPlayer(playerName: string, gameCode: string): Promise<string> {
		const game: Game | undefined = await this.repository.getGame(gameCode);

		if (!game) {
			throw new Error('Game is undefined');
		}

		if (game.state === GameState.InProgress) {
			throw new Error('The game is already in progress');
		} else if (game.state === GameState.Finished) {
			throw new Error('The game has already finished');
		}

		const playerCode = this.generateCode();
		const startingDice = Array.from(Array(game.initialDiceCount), () => 0);

		const newPlayer: Player = {
			name: playerName,
			code: playerCode,
			dice: startingDice
		};

		if (game.players.length < game.maxPlayers) {
			game.players.push(newPlayer);
		} else {
			throw new Error('max player cap check failed');
		}

		await this.repository.saveGame(game);

		return `${gameCode}-${playerCode}`;
	}

	public async startGame(playerToken: string): Promise<void> {
		const { gameCode, playerCode } = this.splitPlayerToken(playerToken);
		const game: Game | undefined = await this.repository.getGame(gameCode);
		if (!game) {
			throw new Error('Game is undefined');
		}

		if (game.players[0].code !== playerCode) {
			throw new Error('Player is not the host');
		}

		if (game.players.length != game.maxPlayers) {
			throw new Error('Not enough players');
		}

		this.rollAllDice(game);

		this.chooseStartingPlayer(game);
		this.updateGameState(GameState.InProgress, game);

		await this.events.recordRoundStart(game.players);

		await this.repository.saveGame(game);
	}

	public async getGame(playerToken: string): Promise<GameDto> {
		const { gameCode, playerCode } = this.splitPlayerToken(playerToken);
		const game: Game | undefined = await this.repository.getGame(gameCode);

		if (!game) {
			throw new Error('Game is undefined');
		}

		if (game.state === GameState.Lobby) {
			return {
				players: game.players.map((player) => ({
					name: player.name,
					isCaller: player.code === playerCode
				})),
				events: [],
				state: GameState.Lobby
			};
		}

		if (game.currentPlayer === undefined) {
			throw new Error('Current player is undefined');
		}

		const numPlayers = game.players.length;
		const playerIndex: number = game.players.findIndex((player) =>
			player.code.includes(playerCode)
		);

		let bidderIndex: number | undefined = undefined;
		if (game.currentBid !== undefined) {
			let previousPlayerIndex: number = game.currentPlayer;
			do {
				previousPlayerIndex = (previousPlayerIndex - 1 + numPlayers) % numPlayers;
				if (game.players[previousPlayerIndex].dice.length > 0) {
					bidderIndex = previousPlayerIndex;
				}
			} while (bidderIndex === undefined);
		}

		const playerDtos: PlayerDto[] = game.players.map((player, i) => {
			return {
				name: player.name,
				isCaller: playerIndex === i,
				lastBid: bidderIndex === i ? game.currentBid : undefined,
				dice: playerIndex === i ? player.dice : undefined,
				currentTurn: game.currentPlayer === i
			};
		});

		const events = await this.events.popPlayerEvents(playerCode);

		const gameDetails: GameDto = {
			players: playerDtos,
			state: game.state,
			events
		};

		return gameDetails;
	}

	public async placeBid(quantity: number, dice: number, playerToken: string): Promise<void> {
		const { gameCode, playerCode } = this.splitPlayerToken(playerToken);
		const game: Game | undefined = await this.repository.getGame(gameCode);
		if (!game) {
			throw new Error('Game is undefined');
		}

		if (game.state !== GameState.InProgress || game.currentPlayer === undefined) {
			throw new Error('Game is not in progress');
		}

		if (game.players[game.currentPlayer].code !== playerCode) {
			throw new Error('Incorrect player');
		}

		if (quantity < 1 || dice < 1 || dice > 6) {
			throw new Error('Invalid bid');
		}

		if (game.currentBid !== undefined) {
			if (quantity < game.currentBid.quantity) {
				throw new Error('Bid must increase');
			} else if (dice <= game.currentBid.dice && quantity === game.currentBid.quantity) {
				throw new Error('Bid must increase');
			}
		}

		game.currentBid = { quantity, dice };

		await this.events.recordBidEvent(
			game.players,
			game.currentBid,
			game.players[game.currentPlayer]
		);

		this.setNextPlayer(game);

		await this.repository.saveGame(game);
	}

	public async challengeBid(playerToken: string): Promise<void> {
		const { gameCode, playerCode } = this.splitPlayerToken(playerToken);
		const game: Game | undefined = await this.repository.getGame(gameCode);
		if (!game) {
			throw new Error('Game is undefined');
		}

		if (game.state !== GameState.InProgress || game.currentPlayer === undefined) {
			throw new Error('Game is not in progress');
		}

		if (game.players[game.currentPlayer].code !== playerCode) {
			throw new Error('Incorrect player');
		}

		if (game.currentBid === undefined) {
			throw new Error('There is no bid to challenge');
		}

		const allDice: number[] = game.players.flatMap((player) => player.dice);
		const matchingDice: number[] = allDice.filter((dice) => dice === game.currentBid?.dice);

		const challenger: Player = game.players[game.currentPlayer];
		let defender: Player;

		let previousPlayerIndex: number = game.currentPlayer;
		do {
			previousPlayerIndex = (previousPlayerIndex - 1 + game.players.length) % game.players.length;
			defender = game.players[previousPlayerIndex];
		} while (defender.dice.length === 0);

		let losingPlayer: Player;
		if (matchingDice.length >= game.currentBid.quantity) {
			losingPlayer = challenger;
		} else {
			losingPlayer = defender;
		}

		await this.events.recordChallengeEvent(
			game.players,
			game.currentBid,
			challenger,
			defender,
			losingPlayer === defender
		);

		losingPlayer.dice.pop();
		const remainingPlayers = game.players.filter((player) => player.dice.length > 0);

		if (remainingPlayers.length === 1) {
			game.state = GameState.Finished;
			await this.events.recordGameEndEvent(game.players, remainingPlayers[0].name);
		} else {
			this.setNextPlayer(game);
			this.rollAllDice(game);

			await this.events.recordRoundStart(game.players);
		}

		game.currentBid = undefined;

		await this.repository.saveGame(game);
	}

	public generateCode() {
		const firstPart = (Math.random() * 46656) | 0;
		const secondPart = (Math.random() * 46656) | 0;
		return ('000' + firstPart.toString(36)).slice(-3) + ('000' + secondPart.toString(36)).slice(-3);
	}

	public splitPlayerToken(playerToken: string): { gameCode: string; playerCode: string } {
		const splitToken: string[] = playerToken.split('-');
		return { gameCode: splitToken[0], playerCode: splitToken[1] };
	}

	private chooseStartingPlayer(game: Game) {
		const numPlayers = game.players.length;
		game.currentPlayer = this.roller.randomNumber(numPlayers);
	}

	private updateGameState(newState: GameState, game: Game) {
		game.state = newState;
	}

	private rollAllDice(game: Game) {
		game.players.forEach((player) => {
			player.dice = this.roller.rollDice(player.dice.length);
		});
	}

	private setNextPlayer(game: Game) {
		if (game.currentPlayer === undefined) {
			throw new Error('No current player set');
		}

		do {
			game.currentPlayer = (game.currentPlayer + 1) % game.players.length;
		} while (game.players[game.currentPlayer].dice.length === 0);
	}
}

const gameRepository =
	import.meta.env.MODE === 'production'
		? new GameDynamoDbRepository()
		: new GameInMemoryRepository();

export const gameService = new GameService(gameRepository, eventService, new Roller());
