<script lang="ts">
  import Mail from '@lucide/svelte/icons/mail';
  import { Icon } from 'svelte-icons-pack';
  import { SiGithub, SiInstagram, SiX, SiYoutube } from 'svelte-icons-pack/si';
  import type { Component } from 'svelte';
  import type { IconType } from 'svelte-icons-pack';

  type SocialLink = {
    name: string;
    href: string;
    icon?: Component;
    pack_icon?: IconType;
  };

  const currentYear = new Date().getFullYear();

  const quickLinks = [
    { name: 'Browse Texts', href: '/texts' },
    { name: 'Lekha', href: '/lekha' },
    { name: 'Tools', href: '/#tools' },
    { name: 'Support Us', href: '/support' }
  ];

  const socialLinks: SocialLink[] = [
    {
      name: 'YouTube',
      href: 'https://www.youtube.com/@TheSanskritChannel',
      pack_icon: SiYoutube
    },
    {
      name: 'Instagram',
      href: 'https://www.instagram.com/thesanskritchannel/',
      pack_icon: SiInstagram
    },
    {
      name: 'X (Twitter)',
      href: 'https://x.com/SanskritChannel',
      pack_icon: SiX
    },
    {
      name: 'GitHub',
      href: 'https://github.com/shubhattin/thesanskritchannel_projects',
      pack_icon: SiGithub
    },
    {
      name: 'Email',
      href: 'mailto:thesanskritchannel@gmail.com',
      icon: Mail
    }
  ];
</script>

<footer class="border-t border-border/40 bg-card/50">
  <div class="mx-auto max-w-6xl px-4 py-12 sm:px-6">
    <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      <!-- Brand Column -->
      <div class="space-y-4">
        <a href="/" class="flex items-center gap-2.5">
          <img src="/icons/tsc_24.png" alt="" width="24" height="24" class="rounded-sm" />
          <span class="font-heading text-lg font-semibold tracking-tight">The Sanskrit Channel</span
          >
        </a>
        <p class="max-w-xs text-sm leading-relaxed text-muted-foreground">
          Exploring authentic Sanskrit literature and making ancient treasures accessible, fun, and
          easy to learn for all.
        </p>
      </div>

      <!-- Quick Links Column -->
      <div class="space-y-4">
        <h3 class="text-sm font-semibold tracking-wider uppercase">Quick Links</h3>
        <nav aria-label="Footer Quick Links">
          <ul class="space-y-2.5">
            {#each quickLinks as link (link.href)}
              <li>
                <a
                  href={link.href}
                  class="text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
                >
                  {link.name}
                </a>
              </li>
            {/each}
          </ul>
        </nav>
      </div>

      <!-- Connect Column -->
      <div class="space-y-4">
        <h3 class="text-sm font-semibold tracking-wider uppercase">Connect</h3>
        <nav aria-label="Social Links">
          <ul class="flex flex-wrap gap-3">
            {#each socialLinks as link (link.href)}
              <li>
                <a
                  href={link.href}
                  target={link.href.startsWith('mailto:') ? undefined : '_blank'}
                  rel={link.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
                  aria-label={link.name}
                  class="flex size-9 items-center justify-center rounded-lg border border-border/50 text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {#if link.pack_icon}
                    <Icon src={link.pack_icon} class="size-4" />
                  {:else if link.icon}
                    {@const LucideIcon = link.icon}
                    <LucideIcon class="size-4" />
                  {/if}
                </a>
              </li>
            {/each}
          </ul>
        </nav>
      </div>
    </div>

    <!-- Bottom Bar -->
    <div class="mt-10 border-t border-border/40 pt-6">
      <p class="text-center text-xs text-muted-foreground">
        &copy;&nbsp;{currentYear} The&nbsp;Sanskrit&nbsp;Channel. All rights reserved.
      </p>
    </div>
  </div>
</footer>
