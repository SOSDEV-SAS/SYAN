<script lang="ts">
  interface Props {
    variant?: 'icon' | 'inline';
    size?: 'tiny' | 'small' | 'medium' | 'large' | 'giant';
    class?: string;
  }

  let { variant = 'inline', size = 'medium', class: className = '' }: Props = $props();
  const widths = { tiny: 24, small: 32, medium: 48, large: 64, giant: 160 };
</script>

<span class={`inline-flex shrink-0 items-center gap-3 ${className}`}>
  <img
    src="/san-logo.png"
    alt={variant === 'icon' ? 'S&AN' : ''}
    width={widths[size]}
    height={widths[size]}
    class="rounded-xl object-contain"
  />
  {#if variant === 'inline'}
    <span class="text-xl font-semibold tracking-tight">S&amp;AN</span>
  {/if}
</span>
