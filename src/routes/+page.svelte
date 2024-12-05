<script lang="ts">
	import { goto } from '$app/navigation';
	import { createGame } from '$lib/apiClient';

	async function createGameClicked() {
		const response = await createGame();

		goto(`/${response.gameCode}/join`);
	}
</script>

<button onclick={createGameClicked}>Create Game</button>
