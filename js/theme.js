const Theme = {
  init() {
    const savedTheme = localStorage.getItem('theme');
    const initialTheme = savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    this.set(initialTheme);
    
    const toggle = document.getElementById('dark-mode-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        this.set(current === 'dark' ? 'light' : 'dark');
      });
    }
  },
  
  set(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    const toggle = document.getElementById('dark-mode-toggle');
    if (toggle) {
      const sun = toggle.querySelector('.sun-icon');
      const moon = toggle.querySelector('.moon-icon');
      if (theme === 'dark') {
        sun.style.display = 'none';
        moon.style.display = 'block';
      } else {
        sun.style.display = 'block';
        moon.style.display = 'none';
      }
    }
  }
};

const Sidebar = {
  init() {
    const sidebar = document.querySelector('.sidebar');
    const main = document.querySelector('.main-content');
    const toggle = document.getElementById('sidebar-toggle');
    
    if (!sidebar || !main) return;
    
    const collapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    this.setState(sidebar, main, collapsed);
    
    if (toggle) {
      toggle.addEventListener('click', () => {
        const isCollapsed = sidebar.classList.contains('collapsed');
        this.setState(sidebar, main, !isCollapsed);
      });
    }
  },
  
  setState(sidebar, main, collapsed) {
    if (collapsed) {
      sidebar.classList.add('collapsed');
      main.classList.add('collapsed');
    } else {
      sidebar.classList.remove('collapsed');
      main.classList.remove('collapsed');
    }
    localStorage.setItem('sidebarCollapsed', collapsed);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    Theme.init();
    Sidebar.init();
  });
} else {
  Theme.init();
  Sidebar.init();
}