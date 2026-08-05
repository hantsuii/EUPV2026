async function renderModules() {
  const grid = document.getElementById("module-grid");
  const resp = await fetch("./modules.json", { cache: "no-store" });
  const config = await resp.json();

  document.getElementById("portal-title").textContent = config.portal_title;
  document.getElementById("portal-subtitle").textContent = config.portal_subtitle;

  const cards = config.modules.map((m) => `
    <article class="card">
      <span class="badge">${m.badge}</span>
      <h3>${m.name}</h3>
      <p>${m.desc}</p>
      <a href="${m.url}" ${m.url.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>进入模块</a>
    </article>
  `).join("");

  grid.innerHTML = cards;
}

renderModules().catch((err) => {
  document.getElementById("module-grid").innerHTML = `<p>模块加载失败：${err}</p>`;
});
