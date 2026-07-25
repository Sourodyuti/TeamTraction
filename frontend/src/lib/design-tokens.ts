export const designTokens = {
  colors: {
    backgrounds: {
      primary: '#0D0714',
      secondary: '#1A0F2E',
      tertiary: '#241642',
      parchment: '#F5E6C8',
      parchmentDark: '#E8D4B9',
    },
    accents: {
      gold: '#D4AF37',
      goldLight: '#F0D57A',
      goldDark: '#B8941F',
      amber: '#FFBF00',
      cyan: '#66FCF1',
      cyanDark: '#00D4C8',
      silver: '#C0C0C0',
      crimson: '#DC143C',
      emerald: '#50C878',
    },
    text: {
      primary: '#F5E6C8',
      secondary: '#D4C4A8',
      muted: '#9B8A6B',
      dark: '#1A0F2E',
      onGold: '#1A0F2E',
    },
    borders: {
      gold: '#D4AF37',
      goldTransparent: 'rgba(212, 175, 55, 0.3)',
      subtle: 'rgba(212, 175, 55, 0.15)',
    },
    status: {
      connected: '#50C878',
      connecting: '#FFBF00',
      disconnected: '#DC143C',
      lost: '#DC143C',
      gotit: '#50C878',
      slower: '#FFBF00',
    },
    spells: {
      muffliato: '#66FCF1',
      marauders: '#D4AF37',
      accio: '#FF6B35',
      gemino: '#BB86FC',
      sonorus: '#FFD700',
      pensieve: '#8A2BE2',
    },
  },
  fonts: {
    display: '"Cinzel", "Georgia", serif',
    wizard: '"MedievalSharp", "Cinzel", cursive',
    body: '"Inter", "system-ui", sans-serif',
    mono: '"JetBrains Mono", "Fira Code", monospace',
  },
  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
    '5xl': '3rem',
    '6xl': '3.75rem',
    '7xl': '4.5rem',
  },
  spacing: {
    0: '0',
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    10: '2.5rem',
    12: '3rem',
    16: '4rem',
    20: '5rem',
    24: '6rem',
    32: '8rem',
  },
  borderRadius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.5rem',
    full: '9999px',
  },
  shadows: {
    glow: '0 0 20px rgba(212, 175, 55, 0.3)',
    glowStrong: '0 0 40px rgba(212, 175, 55, 0.5), 0 0 80px rgba(212, 175, 55, 0.2)',
    glowCyan: '0 0 20px rgba(102, 252, 241, 0.3)',
    inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.3)',
    parchment: '0 4px 20px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(212, 175, 55, 0.2)',
  },
  transitions: {
    fast: '150ms ease-out',
    normal: '300ms ease-out',
    slow: '500ms ease-out',
    spring: '600ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  animations: {
    float: 'float 6s ease-in-out infinite',
    floatSlow: 'float 8s ease-in-out infinite',
    floatFast: 'float 4s ease-in-out infinite',
    pulse: 'pulse 2s ease-in-out infinite',
    shimmer: 'shimmer 2s linear infinite',
    sparkle: 'sparkle 1.5s ease-in-out infinite',
    rotate: 'rotate 20s linear infinite',
    fadeIn: 'fadeIn 0.6s ease-out forwards',
    slideUp: 'slideUp 0.8s ease-out forwards',
    slideDown: 'slideDown 0.8s ease-out forwards',
    scaleIn: 'scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
  },
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
  zIndices: {
    base: 0,
    dropdown: 100,
    sticky: 200,
    modal: 300,
    popover: 400,
    tooltip: 500,
    cursor: 9999,
  },
};

export type DesignTokens = typeof designTokens;

export const cssVariables = `
  :root {
    --color-bg-primary: ${designTokens.colors.backgrounds.primary};
    --color-bg-secondary: ${designTokens.colors.backgrounds.secondary};
    --color-bg-tertiary: ${designTokens.colors.backgrounds.tertiary};
    --color-bg-parchment: ${designTokens.colors.backgrounds.parchment};
    --color-bg-parchment-dark: ${designTokens.colors.backgrounds.parchmentDark};
    
    --color-gold: ${designTokens.colors.accents.gold};
    --color-gold-light: ${designTokens.colors.accents.goldLight};
    --color-gold-dark: ${designTokens.colors.accents.goldDark};
    --color-amber: ${designTokens.colors.accents.amber};
    --color-cyan: ${designTokens.colors.accents.cyan};
    --color-cyan-dark: ${designTokens.colors.accents.cyanDark};
    --color-silver: ${designTokens.colors.accents.silver};
    --color-crimson: ${designTokens.colors.accents.crimson};
    --color-emerald: ${designTokens.colors.accents.emerald};
    
    --color-text-primary: ${designTokens.colors.text.primary};
    --color-text-secondary: ${designTokens.colors.text.secondary};
    --color-text-muted: ${designTokens.colors.text.muted};
    --color-text-dark: ${designTokens.colors.text.dark};
    --color-text-on-gold: ${designTokens.colors.text.onGold};
    
    --color-border-gold: ${designTokens.colors.borders.gold};
    --color-border-gold-transparent: ${designTokens.colors.borders.goldTransparent};
    --color-border-subtle: ${designTokens.colors.borders.subtle};
    
    --font-display: ${designTokens.fonts.display};
    --font-wizard: ${designTokens.fonts.wizard};
    --font-body: ${designTokens.fonts.body};
    --font-mono: ${designTokens.fonts.mono};
    
    --shadow-glow: ${designTokens.shadows.glow};
    --shadow-glow-strong: ${designTokens.shadows.glowStrong};
    --shadow-glow-cyan: ${designTokens.shadows.glowCyan};
    --shadow-parchment: ${designTokens.shadows.parchment};
    
    --transition-fast: ${designTokens.transitions.fast};
    --transition-normal: ${designTokens.transitions.normal};
    --transition-slow: ${designTokens.transitions.slow};
    --transition-spring: ${designTokens.transitions.spring};
  }
  
  @keyframes float {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-20px) rotate(2deg); }
  }
  
  @keyframes float-slow {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-30px) rotate(-2deg); }
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(1.05); }
  }
  
  @keyframes shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  
  @keyframes sparkle {
    0%, 100% { opacity: 0; transform: scale(0) rotate(0deg); }
    50% { opacity: 1; transform: scale(1) rotate(180deg); }
    100% { opacity: 0; transform: scale(0) rotate(360deg); }
  }
  
  @keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(40px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-40px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.8); }
    to { opacity: 1; transform: scale(1); }
  }
  
  @keyframes shimmer-text {
    0% { background-position: 200% center; }
    100% { background-position: -200% center; }
  }
`;