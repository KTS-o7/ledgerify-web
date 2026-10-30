import { render } from "solid-js/web";
import App from "./App";
import "./styles/custom.css";
import { initPWA } from "./lib/pwa";

initPWA();
render(() => <App />, document.getElementById("root")!);
