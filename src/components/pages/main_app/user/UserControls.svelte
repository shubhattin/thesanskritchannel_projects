<script lang="ts">
  import Icon from '~/tools/Icon.svelte';
  import { TrOutlineLogin2 } from 'svelte-icons-pack/tr';
  import { LuRefreshCw, LuUserPlus } from 'svelte-icons-pack/lu';
  import { RiUserFacesAdminLine } from 'svelte-icons-pack/ri';
  import { BiLogOut } from 'svelte-icons-pack/bi';
  import { writable } from 'svelte/store';
  import { AiOutlineUser } from 'svelte-icons-pack/ai';
  import { LanguageIcon } from '~/components/icons';
  import { editing_status_on } from '~/state/main_app/state.svelte';
  import { user_project_info_q } from '~/state/main_app/data.svelte';
  import { VscAccount } from 'svelte-icons-pack/vsc';
  import { OiLinkExternal16, OiSync16 } from 'svelte-icons-pack/oi';
  import { signOut, useSession } from '~/lib/auth-client';
  import Login from './Login.svelte';
  import Signup from './Signup.svelte';
  import ConfirmModal from '~/components/PopoverModals/ConfirmModal.svelte';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Popover from '$lib/components/ui/popover';
  import { get_lang_from_id } from '~/state/lang_list';
  import { client } from '~/api/client';
  import { cn } from '$lib/utils';
  import { is_current_app_scope } from '~/state/user.svelte';

  const session = useSession();

  let user_info = $derived($session.data?.user);

  let pass_enterer_status = writable(false);
  let user_create_modal_status = writable(false);

  const log_out = () => {
    signOut();
    user_popover_status = false;
  };

  const trigger_translations_update = async () => {
    client.translation.trigger_translation_commit.mutate().then((success) => {
      success &&
        setTimeout(() => {
          window.open(
            'https://github.com/shubhattin/thesanskritchannel_projects/actions/workflows/commit_trans.yml',
            '_blank'
          );
        }, 1500);
    });
  };

  let user_popover_status = $state(false);
</script>

<Popover.Root bind:open={user_popover_status}>
  <Popover.Trigger class="p-0">
    <Icon class="text-2xl hover:text-muted-foreground sm:text-[1.78rem]" src={VscAccount} />
  </Popover.Trigger>
  <Popover.Content side="left" align="start" class="w-auto space-y-2 p-2">
    {#if user_info}
      <div class="space-y-1 p-1 select-none sm:space-y-1">
        <div class="space-x-1.5 sm:space-x-2">
          <span class="text-center text-base font-bold">
            {#if user_info.role === 'admin'}
              <Icon class="-mt-1 text-2xl" src={RiUserFacesAdminLine} />
            {:else}
              <Icon class="-mt-1 text-2xl" src={AiOutlineUser} />
            {/if}
            {user_info.name}
          </span>
          <a
            class="inline-block p-0 hover:text-blue-600 dark:hover:text-blue-500"
            href="/user"
            target="_blank"
            rel="noopener noreferrer"
            title="Account Settings"
          >
            <Icon src={OiLinkExternal16} class="text-xl" />
          </a>
        </div>
        <div class="mb-2">
          <ConfirmModal
            popup_state={false}
            close_on_confirm={true}
            confirm_func={log_out}
            title="Are you Sure to Log Out ?"
            button_pos="left"
          >
            <button
              disabled={$editing_status_on}
              class="flex items-center gap-1 rounded-md bg-destructive px-2 py-0.5 pb-0.5 pl-1 text-sm font-bold text-destructive-foreground sm:text-base"
            >
              <Icon class="text-2xl" src={BiLogOut} />
              <span>Logout</span>
            </button>
          </ConfirmModal>
        </div>
        {#if user_info.role !== 'admin' && $user_project_info_q.isSuccess}
          <button
            class={cn(
              'mb-1 block p-0 text-sm outline-none select-none hover:text-muted-foreground',
              $user_project_info_q.isFetching && 'animate-spin'
            )}
            onclick={() => {
              $user_project_info_q.refetch();
            }}
            disabled={$user_project_info_q.isFetching}
          >
            <Icon src={LuRefreshCw} class="text-lg" />
          </button>
          {#if $user_project_info_q.isFetching}
            <div class="h-5 w-full animate-pulse rounded bg-muted"></div>
          {:else if $is_current_app_scope}
            {@const langs = $user_project_info_q.data.languages!}
            {#if langs && langs.length > 0}
              <div>
                <Icon class="text-xl" src={LanguageIcon} /> :
                <span class="text-sm text-muted-foreground">
                  {langs.map((l) => get_lang_from_id(l.lang_id)).join(', ')}
                </span>
              </div>
            {:else}
              <div class="text-sm text-amber-600 dark:text-amber-500">No languages assigned</div>
            {/if}
          {:else}
            <div class="text-sm text-amber-600 dark:text-amber-500">
              You account is not added to Projects Portal scope by Admin
            </div>
          {/if}
        {/if}
        {#if user_info.role === 'admin'}
          <ConfirmModal
            popup_state={false}
            close_on_confirm={true}
            confirm_func={trigger_translations_update}
            title="Are you sure to Sync Database Translations to Main Repository ?"
            body_text={() =>
              'This will commit the translations stored in the database to the main repository.'}
          >
            <button
              disabled={$editing_status_on}
              class="block rounded-md bg-primary px-1.5 py-0.5 font-bold text-primary-foreground"
            >
              <Icon src={OiSync16} class="my-1 mb-1 text-lg" />
              <span class="text-xs">Sync Translations from DB</span>
            </button>
          </ConfirmModal>
        {/if}
      </div>
    {:else}
      <div class="space-y-1 sm:space-y-2">
        <button
          onclick={() => {
            $pass_enterer_status = true;
          }}
          class="group flex w-full items-center space-x-2 rounded-md px-2 py-1 font-bold hover:bg-muted"
        >
          <Icon
            src={TrOutlineLogin2}
            class="-mt-1 -ml-1 text-2xl group-hover:text-muted-foreground sm:text-3xl"
          />
          <span class="text-sm sm:text-base">Login</span>
        </button>
        <button
          onclick={() => {
            $user_create_modal_status = true;
          }}
          class="group flex w-full items-center space-x-2 rounded-md px-2 py-1 font-bold hover:bg-muted"
        >
          <Icon src={LuUserPlus} class="text-xl group-hover:text-muted-foreground sm:text-2xl" />
          <span class="text-sm sm:text-base">Signup</span>
        </button>
      </div>
    {/if}
  </Popover.Content>
</Popover.Root>

<Dialog.Root bind:open={$pass_enterer_status}>
  <Dialog.Content class="w-80 max-w-[calc(100vw-2rem)] p-3">
    <div class="m-2 mb-3">
      <Login />
    </div>
  </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={$user_create_modal_status}>
  <Dialog.Content class="w-80 max-w-[calc(100vw-2rem)] p-3">
    <div class="m-2 mb-3">
      <Signup />
    </div>
  </Dialog.Content>
</Dialog.Root>
