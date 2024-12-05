<script lang="ts">
	import { goto } from '$app/navigation';
	import { onDestroy, onMount } from 'svelte';
	import { getGame, startGame } from '../../../lib/apiClient.js';
	import { GameState } from '../../../types/types.js';

	let { data } = $props();

	let playerList = $state(data.players);

	let playerPoller = $state<number | undefined>(undefined);

	async function start() {
		await startGame(data.playerToken);

		goto(`/${data.gameCode}/game?p=${data.playerToken}`);
	}

	onMount(() => {
		setInterval(async () => {
			const game = await getGame(data.playerToken);

			playerList = game.players;

			if (game.state === GameState.InProgress) {
				goto(`/${data.gameCode}/game?p=${data.playerToken}`);
			}
		}, 5000);
	});

	onDestroy(() => {
		clearInterval(playerPoller);
	});
</script>

<h1>{data.gameCode}</h1>

<h3>Players</h3>
{#each playerList as player}
	<p>{player.name}</p>
{/each}

{#if data.isHost}
	<button type="button" onclick={start}>Start</button>
{:else}
	<p>Waiting for host...</p>
{/if}
