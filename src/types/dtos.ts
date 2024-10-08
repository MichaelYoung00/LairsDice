import type { Event } from './event';
import type { Bid, GameState } from './types';

export type GameDto = {
	players: PlayerDto[];
	state: GameState;
	events: Event[];
};

export type PlayerDto = {
	name: string;
	dice?: number[];
	lastBid?: Bid;
	currentTurn?: boolean;
};
