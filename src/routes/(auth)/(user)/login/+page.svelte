<script lang="ts">
  import { signIn } from '$lib/auth-client';
  import Icon from '~/tools/Icon.svelte';
  import { GoogleIcon } from '~/components/icons';
</script>

<svelte:head>
  <title>Login | The Sanskrit Channel</title>
</svelte:head>

<div class="mt-14 flex items-center justify-center">
  <button
    onclick={async () => {
      await signIn.social({
        provider: 'google',
        callbackURL: '/user'
      });
    }}
    class="btn flex gap-2 rounded-lg preset-outlined-secondary-700-300 font-semibold"
    ><Icon src={GoogleIcon} class="inline-block text-[1.25rem]" />Login with Google</button
  >
</div>
