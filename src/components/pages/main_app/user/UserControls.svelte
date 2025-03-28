<script lang="ts">
  import Icon from '~/tools/Icon.svelte';
  import { TrOutlineLogin2 } from 'svelte-icons-pack/tr';
  import { LuUserPlus } from 'svelte-icons-pack/lu';
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
  import { Modal, Popover } from '@skeletonlabs/skeleton-svelte';
  import { get_lang_from_id } from '~/state/lang_list';

  const session = useSession();

  let user_info = $derived($session.data?.user);

  let pass_enterer_status = writable(false);
  let user_create_modal_status = writable(false);

  const log_out = () => {
    signOut();
    user_popover_status = false;
  };

  const trigger_translations_update = async () => {
    // client.translations.trigger_translations_update.mutate().then((success) => {
    //   success &&
    //     setTimeout(() => {
    //       window.open(
    //         'https://github.com/shubhattin/valmiki_ramayanam/actions/workflows/commit_trans.yml',
    //         '_blank'
    //       );
    //     }, 1500);
    // });
  };

  let user_popover_status = $state(false);
</script>

<Popover
  open={user_popover_status}
  onOpenChange={(e) => (user_popover_status = e.open)}
  positioning={{ placement: 'left-start' }}
  arrow={false}
  contentBase={'card z-50 space-y-2 p-2 rounded-lg shadow-xl bg-zinc-100 dark:bg-surface-900'}
>
  {#snippet trigger()}
    <span class="btn p-0">
      <Icon
        class="text-2xl hover:text-gray-600 sm:text-[1.65rem] dark:hover:text-gray-400"
        src={VscAccount}
      />
    </span>
  {/snippet}
  {#snippet content()}
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
            class="btn p-0 hover:text-blue-600 dark:hover:text-blue-500"
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
              class="btn rounded-md bg-error-600 px-2 py-0 pb-0.5 pl-1 text-sm font-bold text-white sm:text-base"
            >
              <Icon class="text-2xl" src={BiLogOut} />
              <span>Logout</span>
            </button>
          </ConfirmModal>
        </div>
        {#if user_info.role !== 'admin' && $user_project_info_q.isSuccess}
          {#if user_info.is_approved}
            {@const langs = $user_project_info_q.data.langugaes!}
            {#if langs && langs.length > 0}
              <div>
                <Icon class="text-xl" src={LanguageIcon} /> :
                <span class="text-sm text-gray-500 dark:text-gray-300">
                  {langs.map((l) => get_lang_from_id(l.lang_id)).join(', ')}
                </span>
              </div>
            {:else}
              <div class="text-sm text-warning-600 dark:text-warning-500">
                No languages assigned
              </div>
            {/if}
          {:else}
            <div class="text-sm text-warning-600 dark:text-warning-500">
              You account is not approved by Admin
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
              class="btn block rounded-md bg-primary-800 px-1.5 py-0 font-bold text-white dark:bg-primary-900"
            >
              <Icon src={OiSync16} class="my-1 mb-1 text-xl" />
              <span class="text-sm">Sync Translations from DB</span>
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
          class="group flex w-full space-x-2 rounded-md px-2 py-1 font-bold hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <Icon
            src={TrOutlineLogin2}
            class="-mt-1 -ml-1 text-2xl group-hover:text-gray-600 sm:text-3xl dark:group-hover:text-stone-400"
          />
          <span class="text-sm sm:text-base">Login</span>
        </button>
        <button
          onclick={() => {
            $user_create_modal_status = true;
          }}
          class="group flex w-full space-x-2 rounded-md px-2 py-1 font-bold hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <Icon
            src={LuUserPlus}
            class="text-xl group-hover:text-gray-600 sm:text-2xl dark:group-hover:text-stone-400"
          />
          <span class="text-sm sm:text-base">Signup</span>
        </button>
      </div>
    {/if}
  {/snippet}
</Popover>
<Modal
  backdropBackground="backdrop-blur-xs"
  contentBase={'card z-50 space-y-2 p-2 rounded-lg shadow-xl bg-zinc-100 dark:bg-surface-900'}
  open={$pass_enterer_status}
  onOpenChange={(e) => ($pass_enterer_status = e.open)}
>
  {#snippet content()}
    <div class="m-2 mb-3">
      <Login />
    </div>
  {/snippet}
</Modal>
<Modal
  backdropBackground="backdrop-blur-sm"
  contentBase={'card z-50 space-y-2 p-2 rounded-lg shadow-xl bg-zinc-100 dark:bg-surface-900'}
  open={$user_create_modal_status}
  onOpenChange={(e) => ($user_create_modal_status = e.open)}
>
  {#snippet content()}
    <div class="m-2 mb-3">
      <Signup />
    </div>
  {/snippet}
</Modal>
