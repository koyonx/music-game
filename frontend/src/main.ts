import "./style.css";
import { applyTheme, getActiveTheme } from "./themes/themes";
import { navigate, setHost } from "./ui/router";
import { renderMenu } from "./ui/menu";

const app = document.getElementById("app");
if (!app) throw new Error("#app missing");
setHost(app);

applyTheme(getActiveTheme());
window.addEventListener("themechange", () => applyTheme(getActiveTheme()));

navigate(renderMenu);
