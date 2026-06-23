/* ============================================
   科学突破前沿 — 核心逻辑
   ============================================ */

/* --- State --- */
var state = {
  research: [],
  filteredField: '全部',
  searchQuery: '',
  currentView: 'home',
  currentArticle: null,
  theme: 'light'
};

var THEME_KEY = 'rs-theme';
var FIELD_ICONS = {
  '物理': '⚛️', '天文': '🔭', '生物': '🧬',
  '心理': '🧠', '哲学': '💭', '计算机': '💻'
};
var FIELD_ORDER = ['物理', '天文', '生物', '心理', '哲学', '计算机'];

var $ = function (s, p) { return (p || document).querySelector(s); };
var $$ = function (s, p) { return [].slice.call((p || document).querySelectorAll(s)); };

/* --- Init --- */
function init() {
  loadTheme();
  loadData();
  window.addEventListener('popstate', function (e) {
    if (e.state && e.state.view === 'detail') {
      state.currentArticle = e.state.article;
      renderDetail(state.currentArticle);
    } else {
      state.currentView = 'home';
      state.currentArticle = null;
      renderHome();
    }
  });
  // Scroll top button
  window.addEventListener('scroll', function () {
    var btn = $('#topFloat');
    if (btn) btn.classList.toggle('visible', window.scrollY > 300);
  });
}

/* --- Data Loading --- */
function loadData() {
  fetch('data.json?' + Date.now())
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) {
      state.research = data.research || [];
      renderHome();
    })
    .catch(function (err) {
      console.error('data.json 加载失败:', err);
      var app = $('#app');
      if (app) app.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><h3>数据加载失败</h3><p>' + err.message + '</p></div>';
    });
}

/* --- Theme --- */
function loadTheme() {
  var saved = localStorage.getItem(THEME_KEY);
  if (saved) {
    state.theme = saved;
    document.documentElement.setAttribute('data-theme', saved);
    var btn = $('#themeToggleBtn');
    if (btn) btn.textContent = saved === 'dark' ? '☀️' : '🌙';
  }
}
function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', state.theme);
  localStorage.setItem(THEME_KEY, state.theme);
  var btn = $('#themeToggleBtn');
  if (btn) btn.textContent = state.theme === 'dark' ? '☀️' : '🌙';
}

/* --- Filter helpers --- */
function getFilteredResearch() {
  var result = state.research.slice();
  if (state.filteredField !== '全部') {
    result = result.filter(function (a) { return a.field === state.filteredField; });
  }
  if (state.searchQuery) {
    var q = state.searchQuery.toLowerCase();
    result = result.filter(function (a) {
      return a.title.toLowerCase().indexOf(q) !== -1
        || a.summary.toLowerCase().indexOf(q) !== -1
        || a.tags.some(function (t) { return t.toLowerCase().indexOf(q) !== -1; })
        || (a.researchers && a.researchers.some(function (r) { return r.toLowerCase().indexOf(q) !== -1; }));
    });
  }
  return result;
}

function countByField() {
  var counts = {};
  state.research.forEach(function (a) {
    counts[a.field] = (counts[a.field] || 0) + 1;
  });
  return counts;
}

/* --- Navigation --- */
function filterByField(field) {
  state.filteredField = field;
  $$('.field-tab').forEach(function (t) {
    t.classList.toggle('active', t.getAttribute('data-field') === field);
  });
  if (state.currentView === 'home') {
    renderHome();
  }
}

/* ============================================
   HOME RENDER
   ============================================ */
function renderHome() {
  state.currentView = 'home';
  state.currentArticle = null;
  var app = $('#app');
  if (!app) return;

  var filtered = getFilteredResearch();
  var counts = countByField();
  var html = '';

  // Featured: pick highest rated starred or first
  var featured = state.research.filter(function (a) { return a.starred; });
  if (featured.length === 0) featured = state.research.slice(0, 2);
  if (featured.length > 0) {
    html += '<section class="featured-section">';
    featured.slice(0, 2).forEach(function (a) {
      var ratingStars = renderStars(a.innovationRating);
      html += '<div class="featured-card" data-field="' + a.field + '" onclick="openDetail(\'' + a.id + '\')">'
        + '<div class="field-badge">' + (FIELD_ICONS[a.field] || '') + ' ' + a.field + '</div>'
        + '<div class="featured-rating">' + ratingStars + '</div>'
        + '<h2>' + escapeHtml(a.title) + '</h2>'
        + '<div class="featured-meta">'
        + '<span>' + (a.researchers ? a.researchers[0] + ' 等' : '') + '</span>'
        + '<span>' + (a.source ? a.source.journal : '') + '</span>'
        + '<span>' + a.readTime + ' 分钟</span>'
        + '</div>'
        + '<div class="featured-summary">' + escapeHtml(a.summary) + '</div>'
        + '</div>';
    });
    html += '</section>';
  }

  // Field count cards
  html += '<div class="field-counts">';
  html += '<div class="field-count-card" onclick="filterByField(\'全部\')">'
    + '<div class="field-icon">📋</div>'
    + '<div class="field-name">全部</div>'
    + '<div class="field-count">' + state.research.length + '</div>'
    + '<div class="field-unit">项研究</div>'
    + '</div>';
  FIELD_ORDER.forEach(function (f) {
    var c = counts[f] || 0;
    html += '<div class="field-count-card" onclick="filterByField(\'' + f + '\')">'
      + '<div class="field-icon">' + (FIELD_ICONS[f] || '') + '</div>'
      + '<div class="field-name">' + f + '</div>'
      + '<div class="field-count">' + c + '</div>'
      + '<div class="field-unit">项研究</div>'
      + '</div>';
  });
  html += '</div>';

  // Card grid
  if (filtered.length === 0) {
    html += '<div class="empty-state"><div class="empty-icon">🔍</div><h3>没有找到匹配的研究</h3><p>试试其他关键词或领域</p></div>';
  } else {
    html += '<div class="research-grid">';
    filtered.forEach(function (a) {
      var ratingStars = renderStars(a.innovationRating);
      html += '<div class="research-card" onclick="openDetail(\'' + a.id + '\')">'
        + '<div class="card-header">'
        + '<span class="field-tag field-tag-' + a.field + '">' + a.field + '</span>'
        + '<span class="card-rating">' + ratingStars + '</span>'
        + '</div>'
        + '<h3>' + escapeHtml(a.title) + '</h3>'
        + '<div class="card-meta">'
        + '<span>' + (a.researchers ? a.researchers[0] + ' 等' : '') + '</span>'
        + '<span>' + (a.source ? a.source.journal : '') + '</span>'
        + '</div>'
        + '<div class="card-summary">' + escapeHtml(a.summary) + '</div>'
        + '<div class="card-footer">'
        + '<span>' + a.dateAdded + '</span>'
        + '<span>' + a.readTime + ' 分钟</span>'
        + '</div>'
        + '</div>';
    });
    html += '</div>';
  }

  app.innerHTML = html;
}

/* ============================================
   DETAIL RENDER
   ============================================ */
function openDetail(id) {
  var article = null;
  for (var i = 0; i < state.research.length; i++) {
    if (state.research[i].id === id) { article = state.research[i]; break; }
  }
  if (!article) return;
  state.currentView = 'detail';
  state.currentArticle = article;
  history.pushState({ view: 'detail', article: id }, '', '#r-' + id);
  renderDetail(article);
}

function renderDetail(a) {
  var app = $('#app');
  if (!app) return;

  var ratingStars = renderStars(a.innovationRating);
  var fieldTagClass = 'field-tag-' + a.field;

  var html = '<div class="detail-container">';

  // Back button
  html += '<button class="detail-back" onclick="goHome()">← 返回列表</button>';

  // Header
  html += '<div class="detail-header">'
    + '<div class="detail-field-line">'
    + '<span class="detail-field-tag ' + fieldTagClass + '">' + (FIELD_ICONS[a.field] || '') + ' ' + a.field + '</span>'
    + (a.subfield ? '<span class="detail-date">' + escapeHtml(a.subfield) + '</span>' : '')
    + '<span class="detail-date">' + a.dateAdded + '</span>'
    + '</div>'
    + '<h1>' + escapeHtml(a.title) + '</h1>'
    + (a.researchers && a.researchers.length ? '<div class="detail-authors">👤 ' + escapeHtml(a.researchers.join(' · ')) + '</div>' : '')
    + (a.institution ? '<div class="detail-institution">🏛️ ' + escapeHtml(a.institution) + '</div>' : '')
    + (a.source ? '<div class="detail-source">'
      + '<span>📖 ' + escapeHtml(a.source.journal || '') + '</span>'
      + (a.source.doi ? '<span>DOI: ' + escapeHtml(a.source.doi) + '</span>' : '')
      + (a.source.url ? '<a href="' + escapeHtml(a.source.url) + '" target="_blank" rel="noopener">📎 原文链接 →</a>' : '')
      + '<span>📅 ' + (a.source.publicationDate || '') + '</span>'
      + '</div>' : '')
    + '</div>';

  // Rating
  html += '<div class="detail-rating">'
    + '创新性评级：<span class="rating-stars">' + ratingStars + '</span>'
    + '</div>';

  // Breakthrough
  html += '<div class="detail-section">'
    + '<h2><span class="section-icon">🔬</span> 核心突破</h2>'
    + '<div class="section-body">' + escapeHtml(a.breakthrough) + '</div>'
    + '</div>';

  // Significance
  if (a.significance) {
    html += '<div class="detail-section">'
      + '<h2><span class="section-icon">🎯</span> 为什么重要</h2>'
      + '<div class="section-body">' + escapeHtml(a.significance) + '</div>'
      + '</div>';
  }

  // Divergent Extensions
  if (a.divergentExtensions && a.divergentExtensions.length) {
    html += '<div class="detail-section">'
      + '<h2><span class="section-icon">🌐</span> 发散性拓展</h2>';
    a.divergentExtensions.forEach(function (ext) {
      var dirIcon = '';
      if (ext.direction === '跨领域联系') dirIcon = '🔗';
      else if (ext.direction === '应用推演') dirIcon = '🔮';
      else if (ext.direction === '开放问题') dirIcon = '❓';
      html += '<div class="divergent-item">'
        + '<div class="divergent-direction">' + dirIcon + ' ' + escapeHtml(ext.direction) + '</div>'
        + '<div class="divergent-content">' + escapeHtml(ext.content) + '</div>';
      if (ext.relatedFields && ext.relatedFields.length) {
        html += '<div class="divergent-fields">'
          + ext.relatedFields.map(function (f) { return '<span>' + escapeHtml(f) + '</span>'; }).join('')
          + '</div>';
      }
      html += '</div>';
    });
    html += '</div>';
  }

  // Expert Commentary
  if (a.expertCommentary) {
    html += '<div class="detail-section">'
      + '<h2><span class="section-icon">📝</span> 专业点评</h2>'
      + '<div class="section-body">' + escapeHtml(a.expertCommentary) + '</div>'
      + '</div>';
  }

  // Related Milestones
  if (a.relatedMilestones && a.relatedMilestones.length) {
    html += '<div class="detail-section">'
      + '<h2><span class="section-icon">⏳</span> 研究脉络</h2>'
      + '<div class="milestones">';
    a.relatedMilestones.forEach(function (m, i) {
      var isCurrent = (i === a.relatedMilestones.length - 1);
      html += '<div class="milestone-item' + (isCurrent ? ' current' : '') + '">'
        + '<div class="milestone-year">' + m.year + (isCurrent ? ' 🔥' : '') + '</div>'
        + '<div class="milestone-desc">' + escapeHtml(m.description) + '</div>'
        + '</div>';
    });
    html += '</div></div>';
  }

  // Citations
  if (a.citations) {
    html += '<div class="detail-section">'
      + '<h2><span class="section-icon">📋</span> 引用</h2>';
    if (a.citations.formatted) {
      html += '<div class="citation-box" data-copy="' + escapeHtmlBase64(a.citations.formatted) + '">'
        + escapeHtml(a.citations.formatted)
        + '<button class="copy-btn">复制</button>'
        + '</div>';
    }
    if (a.citations.bibtex) {
      html += '<div class="citation-box" data-copy="' + escapeHtmlBase64(a.citations.bibtex) + '">'
        + escapeHtml(a.citations.bibtex)
        + '<button class="copy-btn">复制</button>'
        + '</div>';
    }
    html += '</div>';
  }

  // Tags
  if (a.tags && a.tags.length) {
    html += '<div class="detail-section">'
      + '<h2><span class="section-icon">🏷️</span> 标签</h2>'
      + '<div style="display:flex;flex-wrap:wrap;gap:6px">'
      + a.tags.map(function (t) {
        return '<span style="padding:4px 12px;border-radius:12px;background:var(--surface2);border:1px solid var(--border);font-size:13px">' + escapeHtml(t) + '</span>';
      }).join('')
      + '</div></div>';
  }

  html += '</div>'; // .detail-container
  app.innerHTML = html;
  window.scrollTo({ top: 0 });
}

/* --- Navigation helpers --- */
function goHome() {
  state.currentView = 'home';
  state.currentArticle = null;
  history.pushState({ view: 'home' }, '', window.location.pathname);
  renderHome();
}

function switchTab(tab) {
  // Currently only 'home' tab is implemented
}

/* --- Utilities --- */
function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  var d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}
function escapeHtmlBase64(text) {
  if (typeof text !== 'string') return '';
  return btoa(unescape(encodeURIComponent(text)));
}
function decodeBase64(str) {
  return decodeURIComponent(escape(atob(str)));
}

function renderStars(rating) {
  if (!rating) return '';
  var full = Math.floor(rating);
  var half = rating - full >= 0.5;
  var empty = 5 - full - (half ? 1 : 0);
  return '⭐'.repeat(full) + (half ? '✨' : '') + '☆'.repeat(empty);
}

function copyText(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function () {
      showToast('已复制到剪贴板');
    }).catch(function () {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}
function fallbackCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); showToast('已复制到剪贴板'); } catch (e) {}
  document.body.removeChild(ta);
}

/* --- Toast --- */
var toastTimer;
function showToast(msg) {
  var el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);padding:10px 24px;background:var(--text);color:var(--bg);border-radius:8px;font-size:14px;z-index:999;opacity:0;transition:opacity 0.3s;pointer-events:none';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '0.9';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.style.opacity = '0'; }, 2000);
}

/* --- Copy button delegation --- */
document.addEventListener('click', function (e) {
  var btn = e.target.closest('.copy-btn');
  if (btn) {
    var box = btn.closest('[data-copy]');
    if (box) {
      copyText(decodeBase64(box.getAttribute('data-copy')));
    }
  }
});

/* --- Search --- */
document.addEventListener('DOMContentLoaded', function () {
  var input = $('#searchInput');
  if (input) {
    input.addEventListener('input', function () {
      state.searchQuery = this.value.trim();
      if (state.currentView === 'home') renderHome();
    });
  }
});

/* --- Start --- */
init();
