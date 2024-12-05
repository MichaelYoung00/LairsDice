<script lang="ts">
	import { goto } from '$app/navigation';
	import { addPlayer } from '../../../lib/apiClient';

	let { data } = $props();

	let playerName = $state('');

	async function submitPlayerName() {
		if (!playerName) {
			throw new Error('Player name not defined');
		}

		const response = await addPlayer(playerName, data.gameCode);

		goto(`/${data.gameCode}/lobby?p=${response.playerToken}`);
	}
</script>

<h1>{data.gameCode}</h1>

<label for="player-name">Player name</label>
<input
	id="player-name"
	oninput={(event) => (playerName = (event.target as HTMLInputElement).value)}
	value={playerName}
/>
<button type="button" onclick={submitPlayerName}>Submit</button>
