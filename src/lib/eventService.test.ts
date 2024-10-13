import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { EventService } from './eventService';
import { GameRepository as InMemoryGameRepository } from './gameRepository';
import { EventRepository as InMemoryEventRepository } from './eventRepository';
import { GameService } from './gameService';
import { Roller } from './roller';
import { GameState, PlayerDifficulty } from '../types/types';
import { GameBuilder } from './gameService.test';
import {
	EventType,
	type BidEvent,
	type ChallengeEvent,
	type GameEndEvent,
	type RoundStartEvent
} from '../types/event';
import { BotService } from './botService';

describe('EventService', () => {
	let gameService: GameService;
	let getSpy: MockInstance;

	let eventService: EventService;

	beforeEach(() => {
		const repository = new InMemoryGameRepository();
		eventService = new EventService(new InMemoryEventRepository());
		gameService = new GameService(repository, eventService, new Roller(), new BotService());

		getSpy = vi.spyOn(repository, 'getGame');
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('GameService Integration', () => {
		it('creates a RoundStart event after the game has started', async () => {
			const initialState = new GameBuilder()
				.setState(GameState.Lobby)
				.addPlayer('playerOne', 'p1', [1, 1, 1], PlayerDifficulty.Human)
				.addPlayer('playerTwo', 'p2', [1, 1, 1], PlayerDifficulty.Human)
				.addPlayer('playerThree', 'p3', [1, 1, 1], PlayerDifficulty.Human)
				.build();
			getSpy.mockResolvedValue(initialState);

			const playerOneToken = `${initialState.code}-${initialState.players[0].code}`;
			await gameService.startGame(playerOneToken);
			const events = (await gameService.getGame(playerOneToken)).events;

			expect(events).toHaveLength(1);
			const roundStartEvent = events[0] as RoundStartEvent;
			expect(roundStartEvent.type).toBe(EventType.RoundStart);
			expect(roundStartEvent.diceCounts).toStrictEqual([
				{ name: 'playerOne', diceCount: 3 },
				{ name: 'playerTwo', diceCount: 3 },
				{ name: 'playerThree', diceCount: 3 }
			]);
		});

		it('creates a RoundStart event and a Challenge event after a successful challenge', async () => {
			const initialState = new GameBuilder()
				.setState(GameState.InProgress)
				.addPlayer('playerOne', 'p1', [2, 2], PlayerDifficulty.Human)
				.addPlayer('playerTwo', 'p2', [5], PlayerDifficulty.Human)
				.addPlayer('playerThree', 'p3', [6, 2, 2], PlayerDifficulty.Human)
				.setCurrentPlayer(0)
				.setCurrentBid(5, 2)
				.build();
			getSpy.mockResolvedValue(initialState);

			const playerOneToken = `${initialState.code}-${initialState.players[0].code}`;
			await gameService.challengeBid(playerOneToken);
			const events = (await gameService.getGame(playerOneToken)).events;

			expect(events).toHaveLength(2);

			const challengeEvent = events[0] as ChallengeEvent;
			expect(challengeEvent.type).toBe(EventType.Challenge);
			expect(challengeEvent.challengeSuccess).toBe(true);
			expect(challengeEvent.challengerName).toBe('playerOne');
			expect(challengeEvent.defenderName).toBe('playerThree');
			expect(challengeEvent.dicePool).toStrictEqual([
				{ name: 'playerOne', dice: [2, 2] },
				{ name: 'playerTwo', dice: [5] },
				{ name: 'playerThree', dice: [6, 2, 2] }
			]);

			const roundStartEvent = events[1] as RoundStartEvent;
			expect(roundStartEvent.type).toBe(EventType.RoundStart);
			expect(roundStartEvent.diceCounts).toStrictEqual([
				{ name: 'playerOne', diceCount: 2 },
				{ name: 'playerTwo', diceCount: 1 },
				{ name: 'playerThree', diceCount: 2 }
			]);
		});

		it('creates a RoundStart event and a Challenge event after a failed challenge', async () => {
			const initialState = new GameBuilder()
				.setState(GameState.InProgress)
				.addPlayer('playerOne', 'p1', [1, 1, 1], PlayerDifficulty.Human)
				.addPlayer('playerTwo', 'p2', [1, 1, 1], PlayerDifficulty.Human)
				.addPlayer('playerThree', 'p3', [1, 1, 1], PlayerDifficulty.Human)
				.setCurrentPlayer(0)
				.setCurrentBid(3, 1)
				.build();
			getSpy.mockResolvedValue(initialState);

			const playerOneToken = `${initialState.code}-${initialState.players[0].code}`;
			await gameService.challengeBid(playerOneToken);
			const events = (await gameService.getGame(playerOneToken)).events;

			expect(events).toHaveLength(2);

			const challengeEvent = events[0] as ChallengeEvent;
			expect(challengeEvent.type).toBe(EventType.Challenge);
			expect(challengeEvent.challengeSuccess).toBe(false);
			expect(challengeEvent.challengerName).toBe('playerOne');
			expect(challengeEvent.defenderName).toBe('playerThree');
			expect(challengeEvent.dicePool).toStrictEqual([
				{ name: 'playerOne', dice: [1, 1, 1] },
				{ name: 'playerTwo', dice: [1, 1, 1] },
				{ name: 'playerThree', dice: [1, 1, 1] }
			]);

			const roundStartEvent = events[1] as RoundStartEvent;
			expect(roundStartEvent.type).toBe(EventType.RoundStart);
			expect(roundStartEvent.diceCounts).toStrictEqual([
				{ name: 'playerOne', diceCount: 2 },
				{ name: 'playerTwo', diceCount: 3 },
				{ name: 'playerThree', diceCount: 3 }
			]);
		});

		it('creates a GameEnd event and a Challenge event after a game-ending challenge', async () => {
			const initialState = new GameBuilder()
				.setState(GameState.InProgress)
				.addPlayer('playerOne', 'p1', [2, 2], PlayerDifficulty.Human)
				.addPlayer('playerTwo', 'p2', [1], PlayerDifficulty.Human)
				.addPlayer('playerThree', 'p3', [], PlayerDifficulty.Human)
				.setCurrentPlayer(1)
				.setCurrentBid(2, 2)
				.build();
			getSpy.mockResolvedValue(initialState);

			const playerTwoToken = `${initialState.code}-${initialState.players[1].code}`;
			await gameService.challengeBid(playerTwoToken);
			const events = (await gameService.getGame(playerTwoToken)).events;

			expect(events).toHaveLength(2);

			const challengeEvent = events[0] as ChallengeEvent;
			expect(challengeEvent.type).toBe(EventType.Challenge);
			expect(challengeEvent.challengeSuccess).toBe(false);
			expect(challengeEvent.challengerName).toBe('playerTwo');
			expect(challengeEvent.defenderName).toBe('playerOne');
			expect(challengeEvent.dicePool).toStrictEqual([
				{ name: 'playerOne', dice: [2, 2] },
				{ name: 'playerTwo', dice: [1] },
				{ name: 'playerThree', dice: [] }
			]);

			const gameEndEvent = events[1] as GameEndEvent;
			expect(gameEndEvent.type).toBe(EventType.GameEnd);
			expect(gameEndEvent.winnerName).toBe('playerOne');
		});

		it('creates a Bid event after a player bids', async () => {
			const initialState = new GameBuilder()
				.setState(GameState.InProgress)
				.addPlayer('playerOne', 'p1', [2, 2], PlayerDifficulty.Human)
				.addPlayer('playerTwo', 'p2', [1], PlayerDifficulty.Human)
				.addPlayer('playerThree', 'p3', [6, 1, 2], PlayerDifficulty.Human)
				.setCurrentPlayer(0)
				.setCurrentBid(2, 2)
				.build();
			getSpy.mockResolvedValue(initialState);

			const playerOneToken = `${initialState.code}-${initialState.players[0].code}`;
			await gameService.placeBid(4, 2, playerOneToken);
			const events = (await gameService.getGame(playerOneToken)).events;

			expect(events).toHaveLength(1);

			const bidEvent = events[0] as BidEvent;
			expect(bidEvent.type).toBe(EventType.Bid);
			expect(bidEvent.bid).toStrictEqual({ quantity: 4, dice: 2 });
			expect(bidEvent.bidderName).toBe('playerOne');
		});

		it('creates a Bid event after a bot bids', async () => {
			const initialState = new GameBuilder()
				.setState(GameState.InProgress)
				.addPlayer('playerOne', 'p1', [2, 2], PlayerDifficulty.Easy)
				.addPlayer('playerTwo', 'p2', [1], PlayerDifficulty.Medium)
				.addPlayer('playerThree', 'p3', [6, 1, 2], PlayerDifficulty.Hard)
				.setCurrentPlayer(0)
				.setCurrentBid(2, 2)
				.build();
			getSpy.mockResolvedValue(initialState);

			const playerOneToken = `${initialState.code}-${initialState.players[0].code}`;
			await gameService.placeBid(4, 2, playerOneToken);
			const events = (await gameService.getGame(playerOneToken)).events;

			expect(events).toHaveLength(1);

			const bidEvent = events[0] as BidEvent;
			expect(bidEvent.type).toBe(EventType.Bid);
			expect(bidEvent.bid).toStrictEqual({ quantity: 4, dice: 2 });
			expect(bidEvent.bidderName).toBe('playerOne');
		});

		it('builds up events until the player reads them', async () => {
			const initialState = new GameBuilder()
				.setState(GameState.InProgress)
				.addPlayer('playerOne', 'p1', [2, 2, 1], PlayerDifficulty.Human)
				.addPlayer('playerTwo', 'p2', [1, 1, 1], PlayerDifficulty.Human)
				.addPlayer('playerThree', 'p3', [6, 1, 2], PlayerDifficulty.Human)
				.setCurrentPlayer(0)
				.build();
			getSpy.mockResolvedValue(initialState);

			const p1Code = `${initialState.code}-${initialState.players[0].code}`;
			const p2Code = `${initialState.code}-${initialState.players[1].code}`;
			const p3Code = `${initialState.code}-${initialState.players[2].code}`;
			await gameService.placeBid(1, 1, p1Code);
			await gameService.placeBid(2, 1, p2Code);
			await gameService.placeBid(2, 3, p3Code);
			await gameService.placeBid(3, 1, p1Code);
			await gameService.challengeBid(p2Code);

			let p1Events = (await gameService.getGame(p1Code)).events;
			expect(p1Events).toHaveLength(6);

			p1Events = (await gameService.getGame(p1Code)).events;
			expect(p1Events, 'the p1 message queue should be cleared').toHaveLength(0);

			const p2Events = (await gameService.getGame(p2Code)).events;
			expect(p2Events, 'the p2 message queue should not be cleared').toHaveLength(6);
		});
	});
});
