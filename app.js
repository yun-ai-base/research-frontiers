/* ============================================
   科学突破前沿 — 核心逻辑
   ============================================ */

/* --- State --- */
var PAGE_SIZE = 10; // 首页每页渲染的卡片数（分页/加载更多）
var state = {
  research: [],
  filteredField: '全部',
  searchQuery: '',
  currentView: 'home',
  currentArticle: null,
  visibleCount: PAGE_SIZE,
  theme: 'light'
};

var THEME_KEY = 'rs-theme';
var FIELD_ICONS = {
  '物理': '⚛️', '天文': '🔭', '生物': '🧬',
  '心理': '🧠', '哲学': '💭', '计算机': '💻',
  '数学': '📐', '化学': '⚗️', '医学': '🩺'
};
var FIELD_ORDER = ['物理', '天文', '生物', '心理', '哲学', '计算机', '数学', '化学', '医学'];

var $ = function (s, p) { return (p || document).querySelector(s); };
var $$ = function (s, p) { return [].slice.call((p || document).querySelectorAll(s)); };

/* --- Init --- */
function init() {
  loadTheme();
  loadData();
  window.addEventListener('popstate', function (e) {
    if (e.state && e.state.view === 'detail') {
      openDetail(e.state.article);
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
  // 首页只加载精简索引 index.json（约 15% 体积），完整文章内容按需加载
  fetch('index.json?' + Date.now())
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) {
      state.research = data.research || [];
      renderHome();
    })
    .catch(function (err) {
      console.error('index.json 加载失败:', err);
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
  resetPagination();
  $$('.field-tab').forEach(function (t) {
    t.classList.toggle('active', t.getAttribute('data-field') === field);
  });
  if (state.currentView === 'home') {
    renderHome();
  }
}

/* 筛选/搜索条件变化时，分页回到第一页 */
function resetPagination() {
  state.visibleCount = PAGE_SIZE;
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

  // Card grid（分页：只渲染当前可见数量，其余点「加载更多」增量加载）
  if (filtered.length === 0) {
    html += '<div class="empty-state"><div class="empty-icon">🔍</div><h3>没有找到匹配的研究</h3><p>试试其他关键词或领域</p></div>';
  } else {
    html += '<div class="research-grid" id="researchGrid">';
    filtered.slice(0, state.visibleCount).forEach(function (a) {
      html += cardHtml(a);
    });
    html += '</div>';
    html += loadMoreHtml(filtered.length);
  }

  app.innerHTML = html;
}

/* 单张卡片 HTML（供首页分页/加载更多复用） */
function cardHtml(a) {
  var ratingStars = renderStars(a.innovationRating);
  return '<div class="research-card" onclick="openDetail(\'' + a.id + '\')">'
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
}

/* 加载更多按钮 HTML（列表未展示完时显示） */
function loadMoreHtml(total) {
  var shown = Math.min(state.visibleCount, total);
  if (shown >= total) return '';
  return '<div class="load-more-wrap">'
    + '<button class="load-more-btn" onclick="loadMore()">加载更多（' + (total - shown) + ' 条）</button>'
    + '<span class="load-more-hint">已加载 ' + shown + ' / ' + total + ' 条</span>'
    + '</div>';
}

/* 加载更多：增量追加下一批卡片，不整页重渲染，保持滚动位置 */
function loadMore() {
  var filtered = getFilteredResearch();
  var from = state.visibleCount;
  if (from >= filtered.length) return;
  state.visibleCount += PAGE_SIZE;
  var to = Math.min(state.visibleCount, filtered.length);
  var grid = $('#researchGrid');
  if (!grid) { renderHome(); return; }
  for (var i = from; i < to; i++) {
    grid.insertAdjacentHTML('beforeend', cardHtml(filtered[i]));
  }
  var wrap = grid.parentNode.querySelector('.load-more-wrap');
  if (wrap) {
    wrap.outerHTML = loadMoreHtml(filtered.length);
  }
}

/* ============================================
   DETAIL RENDER
   ============================================ */
/* --- Detail: 按需加载 --- */
function findById(id) {
  for (var i = 0; i < state.research.length; i++) {
    if (state.research[i].id === id) return state.research[i];
  }
  return null;
}

function openDetail(id) {
  var article = findById(id);
  if (!article) return;
  state.currentView = 'detail';
  state.currentArticle = article;
  history.pushState({ view: 'detail', article: id }, '', '#r-' + id);
  // 先用索引数据立即渲染头部，同时按需拉取完整详情
  renderDetailLoading(article);
  fetch('articles/' + encodeURIComponent(id) + '.json?' + Date.now())
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (full) {
      state.currentArticle = full;
      renderDetail(full);
    })
    .catch(function (err) {
      console.error('文章详情加载失败:', err);
      renderDetail(article); // 降级：用索引中的精简数据渲染
    });
}

/* 详情加载中的骨架视图（先用索引数据渲染头部，占位符提示加载中） */
function renderDetailLoading(a) {
  var app = $('#app');
  if (!app) return;
  var fieldTagClass = 'field-tag-' + a.field;
  var html = '<div class="detail-container">'
    + '<button class="detail-back" onclick="goHome()">← 返回列表</button>'
    + '<div class="detail-header">'
    + '<div class="detail-field-line">'
    + '<span class="detail-field-tag ' + fieldTagClass + '">' + (FIELD_ICONS[a.field] || '') + ' ' + a.field + '</span>'
    + (a.subfield ? '<span class="detail-date">' + escapeHtml(a.subfield) + '</span>' : '')
    + '<span class="detail-date">' + a.dateAdded + '</span>'
    + '</div>'
    + '<h1>' + escapeHtml(a.title) + '</h1>'
    + (a.researchers && a.researchers.length ? '<div class="detail-authors">👤 ' + escapeHtml(a.researchers.join(' · ')) + '</div>' : '')
    + (a.institution ? '<div class="detail-institution">🏛️ ' + escapeHtml(a.institution) + '</div>' : '')
    + '</div>'
    + '<div class="detail-loading"><div class="loading-spinner"></div><p>正在加载完整内容…</p></div>'
    + '</div>';
  app.innerHTML = html;
  window.scrollTo({ top: 0 });
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

  // Breakthrough（降级渲染时可能缺失，给出提示）
  html += '<div class="detail-section">'
    + '<h2><span class="section-icon">🔬</span> 核心突破</h2>'
    + '<div class="section-body">' + (a.breakthrough ? escapeHtml(a.breakthrough) : '<div class="detail-placeholder">该条目缺少核心突破内容，或详情文件加载失败。</div>') + '</div>'
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

/* --- 自动更新 --- */
function triggerUpdate() {
  var msg = '🔄 自动抓取最新研究\n\n'
    + '方式一（推荐）：双击 update.bat — 本地自动抓取→AI生成→上传\n\n'
    + '方式二：GitHub 手动触发\n'
    + 'https://github.com/yun-ai-base/research-frontiers/actions/workflows/auto-update.yml\n\n'
    + '方式三：告诉我你发现的研究，我来处理';
  alert(msg);
  window.open('https://github.com/yun-ai-base/research-frontiers/actions/workflows/auto-update.yml', '_blank');
}

/* --- 添加模态框 --- */
function showAddModal() {
  var modal = $('#addModal');
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}
function closeAddModal(e) {
  if (e && e.target !== e.currentTarget) return;
  var modal = $('#addModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

var _lastGeneratedEntry = null;

function generateEntry() {
  var title = $('#addTitle').value.trim();
  var field = $('#addField').value;
  var subfield = $('#addSubfield').value.trim();
  var researchers = $('#addResearchers').value.trim();
  var institution = $('#addInstitution').value.trim();
  var journal = $('#addJournal').value.trim();
  var url = $('#addUrl').value.trim();
  var doi = $('#addDoi').value.trim();
  var summary = $('#addSummary').value.trim();
  var abstract = $('#addAbstract').value.trim();
  var tagsStr = $('#addTags').value.trim();

  if (!title || !field || !journal || !summary) {
    showToast('请填写标题、学科、来源和摘要');
    return;
  }

  var tags = tagsStr ? tagsStr.split(/[,，]/).map(function (t) { return t.trim(); }).filter(Boolean) : [];
  var researchersArr = researchers ? researchers.split(/[·,，]/).map(function (r) { return r.trim(); }).filter(Boolean) : [];
  var now = new Date();
  var dateStr = now.toISOString().slice(0, 10);
  var id = 'r-' + now.getTime();

  var entry = {
    id: id,
    title: title,
    field: field,
    subfield: subfield,
    researchers: researchersArr,
    institution: institution,
    source: {
      journal: journal,
      doi: doi,
      url: url,
      publicationDate: dateStr,
    },
    summary: summary,
    abstract: abstract,
    breakthrough: '（待AI生成）',
    significance: '',
    innovationRating: 0,
    divergentExtensions: [],
    expertCommentary: '',
    relatedMilestones: [],
    tags: tags,
    dateAdded: dateStr,
    readTime: Math.max(3, Math.ceil(abstract.length / 500)),
    status: 'unread',
    starred: false,
    citations: {
      bibtex: '@article{manual' + now.getTime() + ', title={' + title + '}, journal={' + journal + '}, year={' + now.getFullYear() + '}}',
      formatted: title + '. ' + journal + ' (' + now.getFullYear() + ').',
    },
  };

  _lastGeneratedEntry = entry;

  var resultDiv = $('#addResult');
  var resultPre = $('#addResultPre');
  if (resultDiv && resultPre) {
    resultPre.textContent = JSON.stringify(entry, null, 2);
    resultDiv.style.display = 'block';
  }
  showToast('✅ 条目已生成！可下载或复制');
}

function downloadEntry() {
  if (!_lastGeneratedEntry) return;
  var blob = new Blob([JSON.stringify(_lastGeneratedEntry, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'new_entry_' + _lastGeneratedEntry.id + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('📥 已下载');
}

function copyResult() {
  if (!_lastGeneratedEntry) return;
  copyText(JSON.stringify(_lastGeneratedEntry, null, 2));
}

/* --- Search --- */
document.addEventListener('DOMContentLoaded', function () {
  var input = $('#searchInput');
  if (input) {
    input.addEventListener('input', function () {
      state.searchQuery = this.value.trim();
      if (state.currentView === 'home') { resetPagination(); renderHome(); }
    });
  }
});

/* --- Start --- */
init();
