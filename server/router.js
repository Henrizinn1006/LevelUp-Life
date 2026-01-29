const app = document.getElementById("app");
const pageStyle = document.getElementById("pageStyle");

function loadPage(page) {
	fetch(`./pages/${page}.html`)
		.then(r => r.text())
		.then(html => {
			app.innerHTML = html;
			loadStyle(page);
			loadScript(page);
		});
}

function loadStyle(page) {
	pageStyle.href = `./css/${page}.css`;
}

function loadScript(page) {
	const old = document.getElementById("pageScript");
	if (old) old.remove();

	const script = document.createElement("script");
	script.src = `./js/${page}.js`;
	script.id = "pageScript";
	document.body.appendChild(script);
}

// começa no login
loadPage("login");

// deixa global pra trocar depois
window.goTo = loadPage;
