// Critical: Apply theme BEFORE any rendering to prevent FOUC
(function() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = savedTheme || (prefersDark ? 'dark' : 'light');
  
  // Apply theme attribute immediately
  document.documentElement.setAttribute('data-theme', theme);
  
  // Add no-transition class to prevent animations during init
  document.documentElement.classList.add('no-transitions');
})();

const App = {
  initialized: false,
  
  init() {
    if (this.initialized) return;
    this.initialized = true;
    
    Theme.init();
    Sidebar.init();
    Auth.init();
    
    // Remove no-transition class after initial render (allows user-triggered animations)
    requestAnimationFrame(() => {
      setTimeout(() => {
        document.documentElement.classList.remove('no-transitions');
      }, 100);
    });
  }
};

const Theme = {
  current: null,
  
  init() {
    this.current = document.documentElement.getAttribute('data-theme') || 'light';
    
    const toggle = document.getElementById('dark-mode-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => this.toggle());
    }
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('theme')) {
        this.set(e.matches ? 'dark' : 'light');
      }
    });
    
    this.updateToggleIcon();
  },
  
  toggle() {
    this.set(this.current === 'dark' ? 'light' : 'dark');
  },
  
  set(theme) {
    if (theme === this.current) return;
    
    this.current = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    this.updateToggleIcon();
  },
  
  updateToggleIcon() {
    const toggle = document.getElementById('dark-mode-toggle');
    if (!toggle) return;
    
    const sun = toggle.querySelector('.sun-icon');
    const moon = toggle.querySelector('.moon-icon');
    
    if (this.current === 'dark') {
      sun?.style && (sun.style.display = 'none');
      moon?.style && (moon.style.display = 'block');
    } else {
      sun?.style && (sun.style.display = 'block');
      moon?.style && (moon.style.display = 'none');
    }
  }
};

const Sidebar = {
  collapsed: false,
  animationTimeout: null,
  
  init() {
    // Read persisted state immediately
    this.collapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    
    const sidebar = document.querySelector('.sidebar');
    const main = document.querySelector('.main-content');
    const toggle = document.getElementById('sidebar-toggle');
    
    if (!sidebar || !main) return;
    
    // Apply state immediately (no animation due to no-transitions class)
    this.applyState(sidebar, main, this.collapsed, false);
    
    if (toggle) {
      toggle.addEventListener('click', () => this.toggle(sidebar, main));
    }
  },
  
  toggle(sidebar, main) {
    this.collapsed = !this.collapsed;
    this.applyState(sidebar, main, this.collapsed, true);
    this.persist();
  },
  
  applyState(sidebar, main, collapsed, animate) {
    if (collapsed) {
      sidebar.classList.add('collapsed');
      main.classList.add('collapsed');
    } else {
      sidebar.classList.remove('collapsed');
      main.classList.remove('collapsed');
    }
    
    // Clear any pending animations
    if (this.animationTimeout) {
      clearTimeout(this.animationTimeout);
    }
    
    // If animating, add a class to enable smooth transition
    if (animate) {
      sidebar.classList.add('animating');
      main.classList.add('animating');
      
      this.animationTimeout = setTimeout(() => {
        sidebar.classList.remove('animating');
        main.classList.remove('animating');
      }, 350);
    }
  },
  
  persist() {
    localStorage.setItem('sidebarCollapsed', this.collapsed);
  }
};

const Auth = {
  init() {
    const logoutBtn = document.querySelector('[data-action="logout"]');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('authUser');
        window.location.href = 'login.html';
      });
    }
  }
};

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}
