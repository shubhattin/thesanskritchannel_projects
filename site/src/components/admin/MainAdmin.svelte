<script lang="ts">
  import { signOut, useSession } from '$lib/auth-client';
  import * as Popover from '$lib/components/ui/popover';
  import * as Avatar from '$lib/components/ui/avatar';
  import { Button } from '$lib/components/ui/button';
  import { Separator } from '$lib/components/ui/separator';
  import LogOut from '@lucide/svelte/icons/log-out';

  const session = useSession();

  let user = $derived($session.data?.user);
  let open = $state(false);

  function initials(name: string | null | undefined, email: string | undefined) {
    const s = (name || email || '?').trim();
    const parts = s.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
    }
    return s.slice(0, 2).toUpperCase();
  }

  async function log_out() {
    await signOut();
    open = false;
    window.location.assign(window.location.pathname);
  }
</script>

<div class="min-h-[60vh]">
  <header class="flex items-center justify-end border-b border-border px-4 py-3">
    <Popover.Root bind:open>
      <Popover.Trigger
        class="inline-flex max-w-full items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        aria-label="Account menu"
      >
        <Avatar.Root class="size-8">
          {#if user?.image}
            <Avatar.Image src={user.image} alt="" />
          {/if}
          <Avatar.Fallback class="text-xs">{initials(user?.name, user?.email)}</Avatar.Fallback>
        </Avatar.Root>
      </Popover.Trigger>
      <Popover.Content class="w-72 p-0" align="end" side="bottom" sideOffset={8}>
        {#if user}
          <div class="space-y-3 p-3">
            <div class="space-y-1.5 text-sm">
              <p class="text-xs font-medium text-muted-foreground">Name</p>
              <p class="leading-tight font-medium">{user.name}</p>
            </div>
            <div class="space-y-1.5 text-sm">
              <p class="text-xs font-medium text-muted-foreground">Email</p>
              <p class="leading-tight break-all">{user.email}</p>
            </div>
            <Separator />
            <Button variant="outline" class="w-full gap-2" onclick={log_out}>
              <LogOut class="size-4" />
              Log out
            </Button>
          </div>
        {:else}
          <div class="p-3 text-sm text-muted-foreground">Loading account…</div>
        {/if}
      </Popover.Content>
    </Popover.Root>
  </header>

  <div class="p-4 text-sm text-muted-foreground">More admin tools will appear here.</div>
</div>
