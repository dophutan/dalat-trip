module.exports = {
  content: ['./index.html', './main.js'],
  theme: {
    extend: {
      colors: {
        pine: '#16342c',
        moss: '#36594c',
        mist: '#f5f3ed',
        clay: '#c76d52',
        'clay-dark': '#ad573f',
        sand: '#ded3bd',
        paper: '#ede9df',
        parchment: '#e8dfcf'
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      boxShadow: {
        soft: '0 20px 60px rgba(17, 41, 33, .14)',
        card: '0 8px 30px rgba(22, 52, 44, .06)'
      }
    }
  }
};
