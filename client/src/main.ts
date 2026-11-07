import "./styles/main.css";
import { ControlApp } from "./ui/app";

const root = document.querySelector<HTMLElement>("#app");
if (!root) {
  throw new Error("#app root missing");
}

const app = new ControlApp(root);
void app.mount();
