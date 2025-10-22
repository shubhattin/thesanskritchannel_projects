<script lang="ts">
  import { signIn } from '~/lib/auth-client';
  import Icon from '~/tools/Icon.svelte';
  import { GoogleIcon } from '~/components/icons';
</script>

<div class="mt-4 flex flex-col items-center justify-center">
  <button
    onclick={async () => {
      await signIn.social({
        provider: 'google',
        callbackURL: window.location.href
      });
    }}
    class="btn flex gap-2 rounded-lg preset-outlined-secondary-700-300 font-semibold"
    ><Icon src={GoogleIcon} class="inline-block text-[1.25rem]" />Sigup with Google</button
  >
</div>
