<script lang="ts">
  import { Modal } from '@skeletonlabs/skeleton-svelte';
  import { createMutation } from '@tanstack/svelte-query';
  import { BiRename } from 'svelte-icons-pack/bi';
  import { authClient, useSession } from '~/lib/auth-client';
  import Icon from '~/tools/Icon.svelte';

  const session = useSession();

  let user_info = $derived($session.data?.user);

  let update_name_modal_status = $state(false);
  let user_name = $state('');
  let is_edited = $state(false);

  $effect(() => {
    if (user_info && user_info.name) user_name = user_info.name;
  });

  const update_name_mut = createMutation({
    mutationFn: async (name: string) => {
      await authClient.updateUser({
        name: name
      });
    },
    onSuccess: () => {
      update_name_modal_status = false;
    }
  });

  const update_user_name_func = () => {
    if (is_edited) $update_name_mut.mutate(user_name);
  };
</script>

<Modal
  open={update_name_modal_status}
  onOpenChange={(e) => (update_name_modal_status = e.open)}
  contentBase="card z-60 space-y-2 rounded-lg px-3 py-4 shadow-xl dark:bg-surface-900 bg-zinc-100"
  backdropBackground="backdrop-blur-xs"
>
  {#snippet trigger()}
    <span
      class="btn flex gap-1 space-x-1 rounded-md px-1 py-0 hover:bg-gray-200 dark:hover:bg-gray-700"
    >
      <Icon class="text-2xl" src={BiRename} />
      <span class="text-sm font-semibold">Update Name</span>
    </span>
  {/snippet}
  {#snippet content()}
    <div class="text-center text-lg font-bold text-amber-600 dark:text-amber-500">
      Update User Name
    </div>
    <div class="mt-4 space-y-3 sm:space-y-5">
      <label class="block">
        <span class="label-text font-semibold">Name</span>
        <input
          type="text"
          bind:value={user_name}
          class="input w-full"
          oninput={() => (is_edited = true)}
        />
      </label>
      <div class="space-x-1 sm:space-x-2">
        <button
          disabled={!is_edited || $update_name_mut.isPending}
          class="btn bg-secondary-600 dark:bg-secondary-700 rounded-lg px-2 py-1 text-sm font-semibold text-white"
          onclick={update_user_name_func}>Update</button
        >
        <button
          class="btn bg-error-600 rounded-lg px-2 py-1 text-sm font-semibold text-white"
          onclick={() => (update_name_modal_status = false)}>Cancel</button
        >
      </div>
    </div>
  {/snippet}
</Modal>
