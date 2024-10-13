import { PlayerDifficulty, type Bid, type Game } from '../types/types';
import type { GameService } from './gameService';

export class BotService {
	public playBotTurn(playerToken: string, game: Game, gameService: GameService) {
		if (!game || !game.currentPlayer) {
			throw new Error('game is undefined');
		}

		const playerDice = game.players[game.currentPlayer].dice;

		let numDice = 0;
		game.players.forEach((player) => {
			numDice += player.dice.length;
		});
		const currentBid = game.currentBid;

		const { potentialBids, potentialBidValues } = this.getPotentialBids(
			playerDice,
			numDice,
			currentBid
		);

		const bot = game.players[game.currentPlayer];

		if (bot.difficulty === PlayerDifficulty.Easy) {
			const doChallengeBid: boolean = Math.random() >= 0.75;
			if (!currentBid) {
				const highestBidOdds = Math.max(...potentialBidValues);
				const highestOddsIndex = potentialBidValues.indexOf(highestBidOdds);
				gameService.placeBid(
					potentialBids[highestOddsIndex].quantity,
					potentialBids[highestOddsIndex].dice,
					playerToken
				);
			} else if (doChallengeBid) {
				gameService.challengeBid(playerToken);
			} else {
				const bidIndex = this.getRandomInt(0, 5);
				gameService.placeBid(
					potentialBids[bidIndex].quantity,
					potentialBids[bidIndex].dice,
					playerToken
				);
			}
		} else if (bot.difficulty === PlayerDifficulty.Medium) {
			const highestBidOdds = Math.max(...potentialBidValues);
			const highestOddsIndex = potentialBidValues.indexOf(highestBidOdds);
			const fiveLowestOdds: number[] = potentialBidValues.splice(highestOddsIndex, 1);
			const secondHighestOdds = Math.max(...fiveLowestOdds);
			const secondHighestOddsIndex = fiveLowestOdds.indexOf(secondHighestOdds);

			if (!currentBid) {
				const doPlaceBestBid: boolean = Math.random() >= 0.25;
				if (doPlaceBestBid) {
					gameService.placeBid(
						potentialBids[highestOddsIndex].quantity + this.getRandomInt(0, 1),
						potentialBids[highestOddsIndex].dice,
						playerToken
					);
				} else {
					gameService.placeBid(
						potentialBids[secondHighestOddsIndex].quantity + this.getRandomInt(0, 1),
						potentialBids[secondHighestOddsIndex].dice,
						playerToken
					);
				}
			} else {
				const currentBidOdds = this.calculateBidOdds(playerDice, numDice, currentBid);
				if (highestBidOdds > currentBidOdds) {
					const behaviour = this.getRandomInt(1, 10);
					if (behaviour < 3)
						gameService.placeBid(
							potentialBids[secondHighestOddsIndex].quantity,
							potentialBids[secondHighestOddsIndex].dice,
							playerToken
						);
					else if (behaviour > 3 && behaviour < 8) {
						gameService.placeBid(
							potentialBids[highestOddsIndex].quantity,
							potentialBids[highestOddsIndex].dice,
							playerToken
						);
					} else {
						gameService.challengeBid(playerToken);
					}
				} else {
					const behaviour = this.getRandomInt(1, 10);
					if (behaviour < 7) {
						gameService.challengeBid(playerToken);
					} else if (behaviour === 8) {
						gameService.placeBid(
							potentialBids[secondHighestOddsIndex].quantity,
							potentialBids[secondHighestOddsIndex].dice,
							playerToken
						);
					} else {
						gameService.placeBid(
							potentialBids[highestOddsIndex].quantity,
							potentialBids[highestOddsIndex].dice,
							playerToken
						);
					}
				}
			}
		} else if (bot.difficulty === PlayerDifficulty.Hard) {
			const highestBidOdds = Math.max(...potentialBidValues);
			if (!currentBid) {
				const randomDice = this.getRandomInt(1, 6);
				gameService.placeBid(
					this.getRandomInt(1, this.getRandomInt(1, Math.round(numDice / 6))),
					randomDice,
					playerToken
				);
			} else {
				const currentBidOdds = this.calculateBidOdds(playerDice, numDice, currentBid);
				if (highestBidOdds > currentBidOdds) {
					const highestOddsIndex = potentialBidValues.indexOf(highestBidOdds);
					gameService.placeBid(
						potentialBids[highestOddsIndex].quantity,
						potentialBids[highestOddsIndex].dice,
						playerToken
					);
				} else {
					gameService.challengeBid(playerToken);
				}
			}
		}
	}

	private calculateBidOdds(playerDice: number[], numDice: number, bid: Bid): number {
		const playerDiceCount = playerDice.length;

		playerDice.filter((dice) => dice === 1 || dice === bid.dice);
		const numMatchingDice = playerDice.length;

		const numUnknownDice = numDice - (playerDiceCount - numMatchingDice);

		let odds: number = 0.0;

		if (playerDice.length >= bid.quantity) {
			odds = 0;
		} else if (bid.dice !== 1) {
			odds = numMatchingDice + numUnknownDice * (2 / 6);
		} else {
			odds = numMatchingDice + numUnknownDice * (1 / 6);
		}

		return odds;
	}

	private getPotentialBids(
		playerDice: number[],
		numDice: number,
		currentBid: Bid | undefined
	): { potentialBids: Bid[]; potentialBidValues: number[] } {
		const diceFrequency: number[] = new Array(6);

		// Find the frequency of each dice value.
		playerDice.forEach((dice) => {
			diceFrequency[dice - 1]++;
		});

		// Add the number of '1's (wild dice) to each dice frequency (except for the '1's)
		for (let i: number = 1; i < diceFrequency.length; i++) {
			diceFrequency[i] += diceFrequency[0];
		}

		const potentialBids: Bid[] = [];
		const potentialBidValues: number[] = [];
		if (currentBid) {
			for (let i: number = 0; i < diceFrequency.length; i++) {
				let potentialBid: Bid;
				if (i + 1 > currentBid.dice) {
					potentialBid = {
						quantity: currentBid.quantity,
						dice: i + 1
					};
				} else {
					potentialBid = {
						quantity: currentBid.quantity + 1,
						dice: i + 1
					};
				}
				potentialBids.push(potentialBid);
				potentialBidValues.push(this.calculateBidOdds(playerDice, numDice, potentialBid));
			}
		} else {
			for (let i: number = 0; i < diceFrequency.length; i++) {
				const potentialBid: Bid = {
					quantity: diceFrequency[i],
					dice: i + 1
				};
				potentialBids.push(potentialBid);
				potentialBidValues.push(this.calculateBidOdds(playerDice, numDice, potentialBid));
			}
		}

		return { potentialBids, potentialBidValues };
	}

	private getRandomInt(min: number, max: number): number {
		min = Math.ceil(min);
		max = Math.floor(max);
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}
}
