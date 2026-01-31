<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
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

<Dialog.Root bind:open={update_name_modal_status}>
  <Dialog.Trigger>
    <span class="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 hover:bg-muted">
      <Icon class="text-2xl" src={BiRename} />
      <span class="text-sm font-semibold">Update Name</span>
    </span>
  </Dialog.Trigger>
  <Dialog.Content class="max-w-sm">
    <Dialog.Header>
      <Dialog.Title class="text-center text-lg font-bold text-amber-600 dark:text-amber-500">
        Update User Name
      </Dialog.Title>
    </Dialog.Header>
    <div class="mt-4 space-y-3 sm:space-y-5">
      <label class="block">
        <span class="text-sm font-semibold">Name</span>
        <input
          type="text"
          bind:value={user_name}
          class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
          oninput={() => (is_edited = true)}
        />
      </label>
      <div class="flex gap-2">
        <button
          disabled={!is_edited || $update_name_mut.isPending}
          class="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          onclick={update_user_name_func}>Update</button
        >
        <button
          class="rounded-lg bg-destructive px-3 py-1.5 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90"
          onclick={() => (update_name_modal_status = false)}>Cancel</button
        >
      </div>
    </div>
  </Dialog.Content>
</Dialog.Root>
