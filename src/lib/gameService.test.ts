import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { GameService } from './gameService';
import { GameInMemoryRepository } from './gameInMemoryRepository';
import { GameState, type Game, type Player } from '../types/types';
import { Roller } from './roller';
import { EventService } from './eventService';
import { EventInMemoryRepository as InMemoryEventRepository } from './eventInMemoryRepository';

const MOCK_RANDOM = 'aRandomValue';
const MOCK_START_PLAYER = 1;
const MOCK_DICE = [1, 2, 3, 4, 5, 6];

describe('GameService', () => {
	let repository: GameInMemoryRepository;
	let service: GameService;
	let savedGame: Game | undefined;
	let saveSpy: MockInstance;
	let getSpy: MockInstance;

	let events: EventService;

	let roller: Roller;
	let rollSpy: MockInstance;

	beforeEach(() => {
		repository = new GameInMemoryRepository();
		roller = new Roller();
		events = new EventService(new InMemoryEventRepository());
		service = new GameService(repository, events, roller);
		savedGame = undefined;

		saveSpy = vi.spyOn(repository, 'saveGame');
		saveSpy.mockImplementation(async (game) => {
			savedGame = game;
		});

		getSpy = vi.spyOn(repository, 'getGame');

		rollSpy = vi.spyOn(roller, 'rollDice');
		rollSpy.mockReturnValue(MOCK_DICE);

		vi.spyOn(roller, 'randomNumber').mockReturnValue(MOCK_START_PLAYER);

		vi.spyOn(service, 'generateCode').mockReturnValue(MOCK_RANDOM);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('createGame()', () => {
		it('creates an empty game lobby', async () => {
			const returnCode = await service.createGame();

			const expectedState = new GameBuilder().setState(GameState.Lobby).build();
			expect(savedGame).toStrictEqual(expectedState);
			expect(returnCode, 'returns game code').toBe(savedGame?.code);
		});
	});

	describe('addPlayer()', async () => {
		it('can add a player to a lobby', async () => {
			const initialState = new GameBuilder().setState(GameState.Lobby).build();
			getSpy.mockResolvedValue(initialState);

			const returnToken = await service.addPlayer('aName', initialState.code);

			const expectedState = new GameBuilder()
				.setState(GameState.Lobby)
				.addPlayer('aName', MOCK_RANDOM, [0, 0, 0, 0, 0, 0])
				.build();
			expect(savedGame).toStrictEqual(expectedState);
			expect(returnToken, 'returns player token').toBe(`${MOCK_RANDOM}-${MOCK_RANDOM}`);
		});

		it('throws if the lobby is full', async () => {
			const initialState = new GameBuilder().setState(GameState.Lobby).fillRemainingSeats().build();
			getSpy.mockResolvedValue(initialState);

			const func = async () => await service.addPlayer('aName', initialState.code);

			await expect(func).rejects.toThrowError();
		});

		it('throws if the game is in progress', async () => {
			const initialState = new GameBuilder()
				.setState(GameState.InProgress)
				.fillRemainingSeats()
				.build();
			getSpy.mockResolvedValue(initialState);

			const func = async () => await service.addPlayer('aName', initialState.code);

			await expect(func).rejects.toThrowError();
		});

		it('throws if the game does not exist', async () => {
			const func = async () => await service.addPlayer('aName', 'aBadCode');

			await expect(func).rejects.toThrowError();
		});
	});

	describe('startGame()', async () => {
		it('can be used by p1 to start a game with a full lobby', async () => {
			const initialState = new GameBuilder()
				.setState(GameState.Lobby)
				.addPlayer('playerOne', 'p1', [])
				.addPlayer('playerTwo', 'p2', [])
				.addPlayer('playerThree', 'p3', [])
				.build();
			getSpy.mockResolvedValue(initialState);

			// player token is <GAME_CODE>-<PLAYER-CODE>
			const playerOneToken = `${initialState.code}-${initialState.players[0].code}`;
			await service.startGame(playerOneToken);

			const expectedState = new GameBuilder()
				.setState(GameState.InProgress)
				.addPlayer('playerOne', 'p1', MOCK_DICE)
				.addPlayer('playerTwo', 'p2', MOCK_DICE)
				.addPlayer('playerThree', 'p3', MOCK_DICE)
				.setCurrentPlayer(MOCK_START_PLAYER)
				.build();
			expect(savedGame).toStrictEqual(expectedState);
		});

		it('throws if the game does not exist', async () => {
			const badToken = `aBadGameCode-aBadPlayerCode`;
			const func = async () => await service.startGame(badToken);

			await expect(func).rejects.toThrowError();
		});

		it('throws if the player is not p1', async () => {
			const initialState = new GameBuilder().setState(GameState.Lobby).fillRemainingSeats().build();
			getSpy.mockResolvedValue(initialState);

			const playerTwoToken = `${initialState.code}-${initialState.players[1].code}`;
			const func = async () => await service.startGame(playerTwoToken);

			await expect(func).rejects.toThrowError();
		});

		it('throws if the lobby is not full', async () => {
			const initialState = new GameBuilder()
				.setState(GameState.Lobby)
				.addPlayer('aName', 'aCode', [])
				.build();
			getSpy.mockResolvedValue(initialState);

			const playerOneToken = `${initialState.code}-${initialState.players[0].code}`;
			const func = async () => await service.startGame(playerOneToken);

			await expect(func).rejects.toThrowError();
		});
	});

	describe('placeBid', async () => {
		it('can place a higher-quantity bid for the active player', async () => {
			const initialState = new GameBuilder()
				.setState(GameState.InProgress)
				.addPlayer('playerOne', 'p1', [1, 2, 3, 4])
				.addPlayer('playerTwo', 'p2', [1, 2])
				.addPlayer('playerThree', 'p3', [1, 2, 3, 4, 5])
				.setCurrentPlayer(1)
				.setCurrentBid(2, 2)
				.build();
			getSpy.mockResolvedValue(initialState);

			const playerTwoToken = `${initialState.code}-${initialState.players[1].code}`;
			await service.placeBid(3, 2, playerTwoToken);

			const expectedState = new GameBuilder()
				.setState(GameState.InProgress)
				.addPlayer('playerOne', 'p1', [1, 2, 3, 4])
				.addPlayer('playerTwo', 'p2', [1, 2])
				.addPlayer('playerThree', 'p3', [1, 2, 3, 4, 5])
				.setCurrentPlayer(2)
				.setCurrentBid(3, 2)
				.build();
			expect(savedGame).toStrictEqual(expectedState);
		});

		it('can place a higher-dice bid for the active player', async () => {
			const initialState = new GameBuilder()
				.setState(GameState.InProgress)
				.addPlayer('playerOne', 'p1', [1, 2, 3, 4])
				.addPlayer('playerTwo', 'p2', [1, 2])
				.addPlayer('playerThree', 'p3', [1, 2, 3, 4, 5])
				.setCurrentPlayer(0)
				.setCurrentBid(2, 2)
				.build();
			getSpy.mockResolvedValue(initialState);

			const playerOneToken = `${initialState.code}-${initialState.players[0].code}`;
			await service.placeBid(2, 4, playerOneToken);

			const expectedState = new GameBuilder()
				.setState(GameState.InProgress)
				.addPlayer('playerOne', 'p1', [1, 2, 3, 4])
				.addPlayer('playerTwo', 'p2', [1, 2])
				.addPlayer('playerThree', 'p3', [1, 2, 3, 4, 5])
				.setCurrentPlayer(1)
				.setCurrentBid(2, 4)
				.build();
			expect(savedGame).toStrictEqual(expectedState);
		});

		it('can place anything as the first bid', async () => {
			const initialState = new GameBuilder()
				.setState(GameState.InProgress)
				.addPlayer('playerOne', 'p1', [1, 2, 3, 4])
				.addPlayer('playerTwo', 'p2', [1, 2])
				.addPlayer('playerThree', 'p3', [1, 2, 3, 4, 5])
				.setCurrentPlayer(2)
				.build();
			getSpy.mockResolvedValue(initialState);

			const playerThreeToken = `${initialState.code}-${initialState.players[2].code}`;
			await service.placeBid(1, 3, playerThreeToken);

			const expectedState = new GameBuilder()
				.setState(GameState.InProgress)
				.addPlayer('playerOne', 'p1', [1, 2, 3, 4])
				.addPlayer('playerTwo', 'p2', [1, 2])
				.addPlayer('playerThree', 'p3', [1, 2, 3, 4, 5])
				.setCurrentPlayer(0)
				.setCurrentBid(1, 3)
				.build();
			expect(savedGame).toStrictEqual(expectedState);
		});

		it('will skip a player if they have no dice left', async () => {
			const initialState = new GameBuilder()
				.setState(GameState.InProgress)
				.addPlayer('bobby no-dice', 'bnd', [])
				.addPlayer('playerTwo', 'p2', [1, 2])
				.addPlayer('playerThree', 'p3', [1, 2, 3, 4, 5])
				.setCurrentPlayer(2)
				.setCurrentBid(1, 1)
				.build();
			getSpy.mockResolvedValue(initialState);

			const playerThreeToken = `${initialState.code}-${initialState.players[2].code}`;
			await service.placeBid(1, 3, playerThreeToken);

			const expectedState = new GameBuilder()
				.setState(GameState.InProgress)
				.addPlayer('bobby no-dice', 'bnd', [])
				.addPlayer('playerTwo', 'p2', [1, 2])
				.addPlayer('playerThree', 'p3', [1, 2, 3, 4, 5])
				.setCurrentPlayer(1)
				.setCurrentBid(1, 3)
				.build();
			expect(savedGame).toStrictEqual(expectedState);
		});

		it('throws if the game has not started', async () => {
			const initialState = new GameBuilder()
				.setState(GameState.Lobby)
				.addPlayer('playerOne', 'p1', [1, 2, 3, 4])
				.addPlayer('playerTwo', 'p2', [1, 2])
				.addPlayer('playerThree', 'p3', [1, 2, 3, 4, 5])
				.setCurrentPlayer(0)
				.setCurrentBid(4, 4)
				.build();
			getSpy.mockResolvedValue(initialState);

			const playerOneToken = `${initialState.code}-${initialState.players[0].code}`;
			const func = async () => await service.placeBid(5, 4, playerOneToken);

			await expect(func).rejects.toThrowError();
		});

		it('throws if the game is finished', async () => {
			const initialState = new GameBuilder()
				.setState(GameState.Finished)
				.addPlayer('playerOne', 'p1', [1, 2, 3, 4])
				.addPlayer('playerTwo', 'p2', [1, 2])
				.addPlayer('playerThree', 'p3', [1, 2, 3, 4, 5])
				.setCurrentPlayer(0)
				.setCurrentBid(2, 2)
				.build();
			getSpy.mockResolvedValue(initialState);

			const playerOneToken = `${initialState.code}-${initialState.players[0].code}`;
			const func = async () => await service.placeBid(2, 4, playerOneToken);

			await expect(func).rejects.toThrowError();
		});

		it('throws if the bid is the same as the previous bid', async () => {
			const initialState = new GameBuilder()
				.setState(GameState.InProgress)
				.addPlayer('playerOne', 'p1', [1, 2, 3, 4])
				.addPlayer('playerTwo', 'p2', [1, 2])
				.addPlayer('playerThree', 'p3', [1, 2, 3, 4, 5])
				.setCurrentPlayer(0)
				.setCurrentBid(2, 2)
				.build();
			getSpy.mockResolvedValue(initialState);

			const playerOneToken = `${initialState.code}-${initialState.players[0].code}`;
			const func = async () => await service.placeBid(2, 2, playerOneToken);

			await expect(func).rejects.toThrowError();
		});

		it('throws if the bid quantity decreases', async () => {
			const initialState = new GameBuilder()
				.setState(GameState.InProgress)
				.addPlayer('playerOne', 'p1', [1, 2, 3, 4])
				.addPlayer('playerTwo', 'p2', [1, 2])
				.addPlayer('playerThree', 'p3', [1, 2, 3, 4, 5])
				.setCurrentPlayer(0)
				.setCurrentBid(2, 2)
				.build();
			getSpy.mockResolvedValue(initialState);

			const playerOneToken = `${initialState.code}-${initialState.players[0].code}`;
			const func = async () => await service.placeBid(1, 2, playerOneToken);

			await expect(func).rejects.toThrowError();
		});

		it('throws if the bid is invalid', async () => {
			const initialState = new GameBuilder()
				.setState(GameState.InProgress)
				.addPlayer('playerOne', 'p1', [1, 2, 3, 4])
				.addPlayer('playerTwo', 'p2', [1, 2])
				.addPlayer('playerThree', 'p3', [1, 2, 3, 4, 5])
				.setCurrentPlayer(0)
				.setCurrentBid(2, 2)
				.build();
			getSpy.mockResolvedValue(initialState);

			const playerOneToken = `${initialState.code}-${initialState.players[0].code}`;
			const func = async () => await service.placeBid(2, 7, playerOneToken);

			await expect(func).rejects.toThrowError();
		});

		it('throws if called by anyone but the active player', async () => {
			const initialState = new GameBuilder()
				.setState(GameState.InProgress)
				.addPlayer('playerOne', 'p1', [1, 2, 3, 4])
				.addPlayer('playerTwo', 'p2', [1, 2])
				.addPlayer('playerThree', 'p3', [1, 2, 3, 4, 5])
				.setCurrentPlayer(2)
				.setCurrentBid(2, 2)
				.build();
			getSpy.mockResolvedValue(initialState);

			const playerOneToken = `${initialState.code}-${initialState.players[0].code}`;
			const func = async () => await service.placeBid(3, 3, playerOneToken);

			await expect(func).rejects.toThrowError();
		});
	});

	describe('challengeBid', async () => {
		it('can resolve a challenge that the challenger wins', async () => {
			const initialState = new GameBuilder()
				.setState(GameState.InProgress)
				.addPlayer('playerOne', 'p1', [1, 2, 3, 4])
				.addPlayer('playerTwo', 'p2', [1, 2])
				.addPlayer('playerThree', 'p3', [1, 2, 3, 4, 5])
				.setCurrentPlayer(1)
				.setCurrentBid(5, 2)
				.build();
			getSpy.mockResolvedValue(initialState);

			const playerTwoToken = `${initialState.code}-${initialState.players[1].code}`;
			await service.challengeBid(playerTwoToken);

			const expectedState = new GameBuilder()
				.setState(GameState.InProgress)
				.addPlayer('playerOne', 'p1', MOCK_DICE)
				.addPlayer('playerTwo', 'p2', MOCK_DICE)
				.addPlayer('playerThree', 'p3', MOCK_DICE)
				.setCurrentPlayer(2)
				.build();
			expect(savedGame).toStrictEqual(expectedState);
			expect(rollSpy, 'player one rolls three dice').toHaveBeenNthCalledWith(1, 3);
			expect(rollSpy, 'player two rolls two dice').toHaveBeenNthCalledWith(2, 2);
			expect(rollSpy, 'player two rolls five dice').toHaveBeenNthCalledWith(3, 5);
		});

		it('can resolve a challenge that the defender wins', async () => {
			const initialState = new GameBuilder()
				.setState(GameState.InProgress)
				.addPlayer('playerOne', 'p1', [2, 2, 2])
				.addPlayer('playerTwo', 'p2', [2, 2])
				.addPlayer('playerThree', 'p3', [2, 2, 3, 4, 5])
				.setCurrentPlayer(2)
				.setCurrentBid(5, 2)
				.build();
			getSpy.mockResolvedValue(initialState);

			const playerThreeToken = `${initialState.code}-${initialState.players[2].code}`;
			await service.challengeBid(playerThreeToken);

			const expectedState = new GameBuilder()
				.setState(GameState.InProgress)
				.addPlayer('playerOne', 'p1', MOCK_DICE)
				.addPlayer('playerTwo', 'p2', MOCK_DICE)
				.addPlayer('playerThree', 'p3', MOCK_DICE)
				.setCurrentPlayer(0)
				.build();
			expect(savedGame).toStrictEqual(expectedState);
			expect(rollSpy, 'player one rolls three dice').toHaveBeenNthCalledWith(1, 3);
			expect(rollSpy, 'player two rolls two dice').toHaveBeenNthCalledWith(2, 2);
			expect(rollSpy, 'player two rolls four dice').toHaveBeenNthCalledWith(3, 4);
		});

		it('can resolve a challenger win with a skipped player', async () => {
			const initialState = new GameBuilder()
				.setState(GameState.InProgress)
				.addPlayer('playerOne', 'p1', [2, 2, 2])
				.addPlayer('playerTwo', 'p2', [])
				.addPlayer('playerThree', 'p3', [2, 2, 3, 4, 5])
				.setCurrentPlayer(2)
				.setCurrentBid(20, 2)
				.build();
			getSpy.mockResolvedValue(initialState);

			const playerThreeToken = `${initialState.code}-${initialState.players[2].code}`;
			await service.challengeBid(playerThreeToken);

			const expectedState = new GameBuilder()
				.setState(GameState.InProgress)
				.addPlayer('playerOne', 'p1', MOCK_DICE)
				.addPlayer('playerTwo', 'p2', MOCK_DICE)
				.addPlayer('playerThree', 'p3', MOCK_DICE)
				.setCurrentPlayer(0)
				.build();
			expect(savedGame).toStrictEqual(expectedState);
			expect(rollSpy, 'player one rolls two dice').toHaveBeenNthCalledWith(1, 2);
			expect(rollSpy, 'player two rolls no dice').toHaveBeenNthCalledWith(2, 0);
			expect(rollSpy, 'player two rolls five dice').toHaveBeenNthCalledWith(3, 5);
		});

		it('ends the game if only one player has dice left after the challenge', async () => {
			const initialState = new GameBuilder()
				.setState(GameState.InProgress)
				.addPlayer('playerOne', 'p1', [])
				.addPlayer('playerTwo', 'p2', [5])
				.addPlayer('playerThree', 'p3', [4, 4, 3])
				.setCurrentPlayer(2)
				.setCurrentBid(3, 4)
				.build();
			getSpy.mockResolvedValue(initialState);

			const playerThreeToken = `${initialState.code}-${initialState.players[2].code}`;
			await service.challengeBid(playerThreeToken);

			const expectedState = new GameBuilder()
				.setState(GameState.Finished)
				.addPlayer('playerOne', 'p1', [])
				.addPlayer('playerTwo', 'p2', [])
				.addPlayer('playerThree', 'p3', [4, 4, 3])
				.setCurrentPlayer(2)
				.build();
			expect(savedGame).toStrictEqual(expectedState);
			expect(rollSpy).toHaveBeenCalledTimes(0);
		});

		it('throws if the game has not started', async () => {
			const initialState = new GameBuilder()
				.setState(GameState.Lobby)
				.fillRemainingSeats()
				.setCurrentPlayer(0)
				.setCurrentBid(4, 4)
				.build();
			getSpy.mockResolvedValue(initialState);

			const playerOneToken = `${initialState.code}-${initialState.players[0].code}`;
			const func = async () => await service.challengeBid(playerOneToken);

			await expect(func).rejects.toThrowError();
		});

		it('throws if the game is finished', async () => {
			const initialState = new GameBuilder()
				.setState(GameState.Finished)
				.fillRemainingSeats()
				.setCurrentPlayer(0)
				.setCurrentBid(2, 2)
				.build();
			getSpy.mockResolvedValue(initialState);

			const playerOneToken = `${initialState.code}-${initialState.players[0].code}`;
			const func = async () => await service.challengeBid(playerOneToken);

			await expect(func).rejects.toThrowError();
		});

		it('throws if called by anyone but the active player', async () => {
			const initialState = new GameBuilder()
				.setState(GameState.InProgress)
				.fillRemainingSeats()
				.setCurrentPlayer(2)
				.setCurrentBid(2, 2)
				.build();
			getSpy.mockResolvedValue(initialState);

			const playerOneToken = `${initialState.code}-${initialState.players[0].code}`;
			const func = async () => await service.challengeBid(playerOneToken);

			await expect(func).rejects.toThrowError();
		});
	});

	describe('getGame', () => {
		it('returns the game state relative to the calling player', async () => {
			const initialState = new GameBuilder()
				.setState(GameState.InProgress)
				.addPlayer('playerOne', 'p1', [5, 3, 3, 4])
				.addPlayer('playerTwo', 'p2', [2, 2])
				.addPlayer('playerThree', 'p3', [4, 4, 3])
				.setCurrentPlayer(0)
				.setCurrentBid(3, 4)
				.build();
			getSpy.mockResolvedValue(initialState);

			const playerTwoToken = `${initialState.code}-${initialState.players[1].code}`;
			const result = await service.getGame(playerTwoToken);

			expect(result.state).toBe(GameState.InProgress);
			expect(result.players).toHaveLength(3);
			expect(result.players[0].name).toBe('playerOne');
			expect(result.players[0].lastBid).toBeUndefined();
			expect(result.players[0].currentTurn).toBe(true);
			expect(result.players[0].dice).toBeUndefined();
			expect(result.players[0].isCaller).toBe(false);
			expect(result.players[1].name).toBe('playerTwo');
			expect(result.players[1].lastBid).toBeUndefined();
			expect(result.players[1].currentTurn).toBe(false);
			expect(result.players[1].dice).toStrictEqual([2, 2]);
			expect(result.players[1].isCaller).toBe(true);
			expect(result.players[2].name).toBe('playerThree');
			expect(result.players[2].lastBid).toStrictEqual({ quantity: 3, dice: 4 });
			expect(result.players[2].currentTurn).toBe(false);
			expect(result.players[2].dice).toBeUndefined();
			expect(result.players[2].isCaller).toBe(false);
		});

		it('can be called on a lobby', async () => {
			const initialState = new GameBuilder()
				.setState(GameState.Lobby)
				.addPlayer('playerOne', 'p1', [0, 0, 0])
				.addPlayer('playerTwo', 'p2', [0, 0, 0])
				.build();
			getSpy.mockResolvedValue(initialState);

			const playerTwoToken = `${initialState.code}-${initialState.players[1].code}`;
			const result = await service.getGame(playerTwoToken);
			expect(result.state).toBe(GameState.Lobby);
			expect(result.players).toHaveLength(2);
			expect(result.players[0].name).toBe('playerOne');
			expect(result.players[0].lastBid).toBeUndefined();
			expect(result.players[0].currentTurn).toBeUndefined();
			expect(result.players[0].dice).toBeUndefined();
			expect(result.players[0].isCaller).toBe(false);
			expect(result.players[1].name).toBe('playerTwo');
			expect(result.players[1].lastBid).toBeUndefined();
			expect(result.players[1].currentTurn).toBeUndefined();
			expect(result.players[1].dice).toBeUndefined();
			expect(result.players[1].isCaller).toBe(true);
			expect(result.events).toStrictEqual([]);
		});
	});

	it('can run a full game', async () => {
		// all dice roll 1's
		const mockStore = { savedGame };
		getSpy.mockImplementation(() => mockStore.savedGame);
		saveSpy.mockImplementation((game) => (mockStore.savedGame = game));
		rollSpy.mockImplementation((quantity) => Array.from(Array(quantity), () => 1));

		const gameCode = await service.createGame();
		const p1Code = await service.addPlayer('playerOne', gameCode);
		const p2Code = await service.addPlayer('playerTwo', gameCode);
		const p3Code = await service.addPlayer('playerThree', gameCode);
		await service.startGame(p1Code);

		// round 1: p2 starts and loses die
		await service.placeBid(2, 2, p2Code);
		await service.placeBid(3, 2, p3Code);
		await service.placeBid(4, 3, p1Code);
		await service.placeBid(6, 3, p2Code);
		await service.challengeBid(p3Code);

		// round 2: p2 makes an ill-advised challenge and loses a die
		await service.placeBid(1, 1, p1Code);
		await service.challengeBid(p2Code);

		// round 3: p2 survives p3's challenge
		await service.placeBid(2, 1, p3Code);
		await service.placeBid(3, 1, p1Code);
		await service.placeBid(7, 1, p2Code);
		await service.challengeBid(p3Code);

		// round 4 - 7: p2 keeps losing and is out of dice
		await service.placeBid(3, 1, p1Code);
		await service.challengeBid(p2Code);
		await service.placeBid(2, 1, p3Code);
		await service.placeBid(3, 1, p1Code);
		await service.challengeBid(p2Code);
		await service.placeBid(2, 1, p3Code);
		await service.placeBid(3, 1, p1Code);
		await service.challengeBid(p2Code);
		await service.placeBid(2, 1, p3Code);
		await service.placeBid(3, 1, p1Code);
		await service.challengeBid(p2Code);

		// round 8 - 13: p1 loses six rounds in a row and is out of dice
		await service.placeBid(2, 1, p3Code);
		await service.placeBid(20, 1, p1Code);
		await service.challengeBid(p3Code);
		await service.placeBid(20, 1, p1Code);
		await service.challengeBid(p3Code);
		await service.placeBid(20, 1, p1Code);
		await service.challengeBid(p3Code);
		await service.placeBid(20, 1, p1Code);
		await service.challengeBid(p3Code);
		await service.placeBid(20, 1, p1Code);
		await service.challengeBid(p3Code);
		await service.placeBid(20, 1, p1Code);
		await service.challengeBid(p3Code);

		const expectedState = new GameBuilder()
			.setState(GameState.Finished)
			.addPlayer('playerOne', MOCK_RANDOM, [])
			.addPlayer('playerTwo', MOCK_RANDOM, [])
			.addPlayer('playerThree', MOCK_RANDOM, [1, 1, 1, 1, 1])
			.setCurrentPlayer(2)
			.build();
		expect(mockStore.savedGame).toStrictEqual(expectedState);
	});
});

export class GameBuilder {
	private game: Game;

	constructor() {
		this.game = {
			state: GameState.Lobby,
			code: MOCK_RANDOM,
			players: [],
			currentBid: undefined,
			currentPlayer: undefined,
			maxPlayers: 3,
			initialDiceCount: 6
		};
	}

	setCode(code: string): GameBuilder {
		this.game.code = code;

		return this;
	}

	setState(state: GameState): GameBuilder {
		this.game.state = state;

		return this;
	}

	addPlayer(name: string, code: string, dice: number[]): GameBuilder {
		const player: Player = {
			code,
			name,
			dice
		};
		this.game.players.push(player);

		return this;
	}

	fillRemainingSeats(): GameBuilder {
		while (this.game.players.length < 3) {
			const num = this.game.players.length;
			const player: Player = {
				name: `Player ${num}`,
				code: `p${num}`,
				dice: []
			};
			this.game.players.push(player);
		}

		return this;
	}

	setCurrentPlayer(playerIndex: number): GameBuilder {
		this.game.currentPlayer = playerIndex;

		return this;
	}

	setCurrentBid(quantity: number, dice: number): GameBuilder {
		this.game.currentBid = { quantity, dice };

		return this;
	}

	build(): Game {
		return this.game;
	}
}
