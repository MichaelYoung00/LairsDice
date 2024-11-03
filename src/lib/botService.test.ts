import { BotService } from './botService';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { GameBuilder } from './gameService.test';
import { GameState, PlayerDifficulty, type Game } from '../types/types';
import { GameRepository } from './gameRepository';
import { GameService } from './gameService';
import { EventService } from './eventService';
import { EventRepository as InMemoryEventRepository } from './eventRepository';
import { Roller } from './roller';
import type { PlayerDto } from '../types/dtos';

//const MOCK_RANDOM = 'aRandomValue';
const MOCK_START_PLAYER = 2;
const MOCK_DICE = [1, 2, 3, 4, 5, 6];

describe('BotService', () => {
	let repository: GameRepository;
	let service: GameService;
	let savedGame: Game | undefined;
	let saveSpy: MockInstance;
	let getSpy: MockInstance;

	let events: EventService;

	let botService: BotService;

	let roller: Roller;
	let rollSpy: MockInstance;

	beforeEach(() => {
		repository = new GameRepository();
		roller = new Roller();
		events = new EventService(new InMemoryEventRepository());
		botService = new BotService();
		service = new GameService(repository, events, roller, botService);
		savedGame = undefined;

		saveSpy = vi.spyOn(repository, 'saveGame');
		saveSpy.mockImplementation(async (game) => {
			savedGame = game;
		});

		getSpy = vi.spyOn(repository, 'getGame');

		rollSpy = vi.spyOn(roller, 'rollDice');
		rollSpy.mockReturnValue(MOCK_DICE);

		vi.spyOn(roller, 'randomNumber').mockReturnValue(MOCK_START_PLAYER);

		//vi.spyOn(service, 'generateCode').mockReturnValue(MOCK_RANDOM_PLAYERCODE);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe.skip('getBotPlayers', async () => {
		it('returns a list of player details', async () => {
			const initialState = new GameBuilder()
				.setState(GameState.Lobby)
				.addBotPlayer('player one', 'p1', [], PlayerDifficulty.Easy)
				.addBotPlayer('player two', 'p2', [], PlayerDifficulty.Medium)
				.addBotPlayer('player three', 'p3', [], PlayerDifficulty.Hard)
				.build();
			getSpy.mockResolvedValue(initialState);

			const playerOneToken = `${initialState.code}-p1`;
			const result = await service.getPlayers(playerOneToken);

			const expectedPlayers: PlayerDto[] = [
				{ name: 'player one' },
				{ name: 'player two' },
				{ name: 'player three' }
			];
			expect(result).toStrictEqual(expectedPlayers);
		});

		it('throws if the game does not exist', async () => {
			const badToken = `aBadGameCode-aBadPlayerCode`;
			const func = async () => await service.getPlayers(badToken);

			await expect(func).rejects.toThrowError();
		});
	});

	describe.skip('Placing Intial Bids', async () => {
		it('easy bot should place their best bid', async () => {
			const initialState = new GameBuilder()
				.setState(GameState.InProgress)
				.addBotPlayer('playerOne', 'p1', [5, 3, 3, 4, 3, 5, 1, 2], PlayerDifficulty.Easy)
				.addBotPlayer('playerTwo', 'p2', [2, 2, 5, 1, 6], PlayerDifficulty.Medium)
				.addBotPlayer('playerThree', 'p3', [4, 4, 3, 6], PlayerDifficulty.Hard)
				.setCurrentPlayer(0)
				.build();
			getSpy.mockResolvedValue(initialState);

			const playerOneToken = `${initialState.code}-${initialState.players[0].code}`;
			await service.placeBid(3, 2, playerOneToken);

			const expectedState = new GameBuilder()
				.setState(GameState.InProgress)
				.addBotPlayer('playerOne', 'p1', [5, 3, 3, 4, 3, 5, 1, 2], PlayerDifficulty.Easy)
				.addBotPlayer('playerTwo', 'p2', [2, 2, 5, 1, 6], PlayerDifficulty.Medium)
				.addBotPlayer('playerThree', 'p3', [4, 4, 3, 6], PlayerDifficulty.Hard)
				.setCurrentPlayer(1)
				.setCurrentBid(4, 3)
				.build();
			expect(savedGame).toStrictEqual(expectedState);
		});
	});

	it('can run a full game with only bots', async () => {
		// all dice roll 1's
		const mockStore = { savedGame };
		getSpy.mockImplementation(() => mockStore.savedGame);
		saveSpy.mockImplementation((game) => (mockStore.savedGame = game));
		rollSpy.mockImplementation((quantity) => Array.from(Array(quantity), () => 1));

		// function wait(ms: number) {
		// 	return new Promise((resolve) => setTimeout(resolve, ms));
		// }

		const gameCode = await service.createGame();
		const p1Code = await service.addBotPlayer('playerOne', PlayerDifficulty.Easy, gameCode);
		await service.addBotPlayer('playerTwo', PlayerDifficulty.Medium, gameCode);
		await service.addBotPlayer('playerThree', PlayerDifficulty.Hard, gameCode);
		await service.startGame(p1Code);

		// await wait(1000);

		console.log('Game at the end of test: ', mockStore.savedGame);
		expect(mockStore.savedGame?.state).toStrictEqual(GameState.Finished);
	});
});
