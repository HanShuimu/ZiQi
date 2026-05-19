import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./skins/default/tokens.css";
import "./skins/animalIsland/tokens.css";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

